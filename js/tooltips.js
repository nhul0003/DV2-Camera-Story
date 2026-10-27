// =====================================================================
// Tooltip cards
// Vega-Lite still decides WHAT each tooltip shows (the "tooltip" lists in
// each chart file). This file only changes HOW it looks: instead of a plain
// table, each chart gets a small card with a heading, one big number in the
// section colour, a tiny chart for context and a one-line note.
// The tiny charts use the same CSV files as the main charts.
// =====================================================================
var Tip = (function () {

  var C = { film: "#C8862A", digital: "#1B7F8C", phone: "#6A4C93", aus: "#C23B22", ink: "#1F1F1F", grey: "#A9A49A" };
  var data = {};   // filled by load()

  // ---------- reading the CSV files ----------
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    var keys = rows.shift();
    return rows.filter(function (r) { return r.length > 1; }).map(function (r) {
      var o = {}; keys.forEach(function (k, j) { o[k.trim()] = r[j]; }); return o;
    });
  }
  function getCSV(url) { return fetch(url).then(function (r) { return r.text(); }).then(parseCSV); }

  function load() {
    return Promise.all([
      getCSV("data/s1_camera_types.csv"),
      getCSV("data/s2_film_cameras.csv"),
      getCSV("data/s2_colour_film.csv"),
      getCSV("data/cameras.csv"),
      getCSV("data/share-population-mobile-phone.csv"),
      getCSV("data/ict-adoption-per-100-people.csv")
    ]).then(function (f) {
      // Section 1: share of each camera type in each decade
      var DEC = []; for (var d = 1880; d <= 2000; d += 10) DEC.push(d);
      var byDec = {}, total = {};
      f[0].forEach(function (r) {
        var y = +r.year_made; if (y < 1880 || y >= 2010) return;
        var dec = Math.floor(y / 10) * 10, t = r.camera_type === "Pocket & cartridge" ? "Pocket" : r.camera_type;
        byDec[t] = byDec[t] || {}; byDec[t][dec] = (byDec[t][dec] || 0) + 1; total[dec] = (total[dec] || 0) + 1;
      });
      data.decades = DEC;
      data.typeShare = {};
      Object.keys(byDec).forEach(function (t) { data.typeShare[t] = DEC.map(function (d) { return (byDec[t][d] || 0) / total[d]; }); });

      // Section 2: exports by country and year (US$ million), and world ranks
      function trade(rows) {
        var out = { years: [2000, 2005, 2010, 2015, 2019, 2023], value: {}, rank: {} };
        var byYear = {};
        rows.forEach(function (r) {
          if (r.Reporter === "World" || r.Reporter === "European Union") return;
          var v = +r["Trade Value 1000USD"] / 1000, y = +r.Year;
          out.value[r.Reporter] = out.value[r.Reporter] || {}; out.value[r.Reporter][y] = v;
          (byYear[y] = byYear[y] || []).push([r.Reporter, v]);
        });
        Object.keys(byYear).forEach(function (y) {
          byYear[y].sort(function (a, b) { return b[1] - a[1]; }).forEach(function (p, i) {
            out.rank[p[0]] = out.rank[p[0]] || {}; out.rank[p[0]][y] = i + 1;
          });
        });
        return out;
      }
      data.cams = trade(f[1]);
      data.film = trade(f[2]);

      // Section 3: camera models per brand per year, sensors per year
      var Y = []; for (var y = 1994; y <= 2025; y++) Y.push(y);
      data.years = Y; data.brandYear = {}; data.yearTotal = {}; data.sensor = {};
      f[3].forEach(function (r) {
        var yr = +r.year, b = r.brand;
        data.brandYear[b] = data.brandYear[b] || {}; data.brandYear[b][yr] = (data.brandYear[b][yr] || 0) + 1;
        data.yearTotal[yr] = (data.yearTotal[yr] || 0) + 1;
        var s = r.sensor_type === "CCD" ? "CCD" : r.sensor_type === "CMOS" ? "CMOS" : "Other or unknown";
        data.sensor[yr] = data.sensor[yr] || { CMOS: 0, CCD: 0, "Other or unknown": 0 }; data.sensor[yr][s]++;
      });

      // Section 4: phone ownership by country, and Australia's subscriptions
      var VAL = "Proportion of individuals who own a mobile telephone";
      data.own = {};
      f[4].forEach(function (r) { data.own[r.Entity] = data.own[r.Entity] || {}; data.own[r.Entity][+r.Year] = +r[VAL]; });
      data.ict = { "Mobile phone subscriptions": {}, "Landline phone subscriptions": {} };
      f[5].forEach(function (r) {
        if (r.Entity !== "Australia") return;
        ["Mobile phone subscriptions", "Landline phone subscriptions"].forEach(function (k) { if (r[k] !== "") data.ict[k][+r.Year] = +r[k]; });
      });
      data.ready = true;
    }).catch(function (e) { console.error("Tooltip data not loaded", e); });
  }

  // ---------- small helpers ----------
  function num(x) { return Number(String(x).replace(/[^0-9.\-]/g, "")); }
  function fmt(n, d) { return Number(n).toLocaleString("en-AU", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function money(m) { return m >= 1 ? "US$" + fmt(m, 1) + "m" : m >= 0.001 ? "US$" + fmt(m * 1000) + "k" : "US$" + fmt(m * 1e6); }
  function pct(x, d) { return fmt(x * 100, d || 0) + "%"; }

  // A row of small bars; the highlighted bar is solid, the rest pale.
  function bars(values, labels, hi) {
    var w = 220, h = 46, n = values.length, gap = n > 20 ? 1.5 : 3, bw = (w - gap * (n - 1)) / n;
    var max = Math.max.apply(null, values) || 1, out = "";
    values.forEach(function (v, i) {
      var bh = Math.max(v > 0 ? 1.5 : 0, (v / max) * (h - 14)), x = i * (bw + gap);
      out += '<rect x="' + x.toFixed(1) + '" y="' + (h - 14 - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1" class="' + (i === hi ? "on" : "off") + '"/>';
      if (labels[i]) out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + h + '" class="' + (i === hi ? "on" : "") + '">' + labels[i] + "</text>";
    });
    return '<svg class="tt-spark" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">' + out + "</svg>";
  }
  // A small line through all values, with a dot on the highlighted one.
  function line(values, hi, first, last) {
    // scaled between the smallest and largest value, so small changes are still visible
    var ok = values.filter(isFinite), w = 220, h = 46, top = 5, bottom = h - 14;
    var max = Math.max.apply(null, ok), min = Math.min.apply(null, ok), span = (max - min) || 1;
    var pts = values.map(function (v, i) { return [i * (w - 10) / (values.length - 1) + 5, bottom - ((isFinite(v) ? v : min) - min) / span * (bottom - top)]; });
    var path = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("");
    var dot = hi >= 0 ? '<circle cx="' + pts[hi][0].toFixed(1) + '" cy="' + pts[hi][1].toFixed(1) + '" r="4" class="dot"/>' : "";
    return '<svg class="tt-spark" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><path d="' + path + '" class="line"/>' + dot +
      '<text x="5" y="' + h + '" style="text-anchor:start">' + first + '</text><text x="' + (w - 5) + '" y="' + h + '" style="text-anchor:end">' + last + "</text></svg>";
  }
  // A thin bar split into shares, with a key underneath.
  function mix(parts, digits) {
    var bar = parts.map(function (p) { return '<span style="width:' + (p[1] * 100).toFixed(1) + "%;background:" + p[2] + '"></span>'; }).join("");
    var key = parts.map(function (p) { return '<span><i style="background:' + p[2] + '"></i>' + p[0] + " " + pct(p[1], digits) + "</span>"; }).join("");
    return '<div class="tt-mix">' + bar + '</div><div class="tt-mix-key">' + key + "</div>";
  }
  function card(colour, parts) { return '<div class="tt" style="--tt:' + colour + '">' + parts.join("") + "</div>"; }
  function kicker(t) { return '<p class="tt-kicker">' + t + "</p>"; }
  function title(t) { return '<p class="tt-title">' + t + "</p>"; }
  function big(n, rest) { return '<p class="tt-big"><b>' + n + "</b>" + (rest || "") + "</p>"; }
  function sub(t) { return '<p class="tt-sub">' + t + "</p>"; }
  function note(t) { return '<p class="tt-note">' + t + "</p>"; }
  function series(obj, keys) { return keys.map(function (k) { return obj && obj[k] !== undefined ? obj[k] : NaN; }); }
  function edgeLabels(keys, hi, fmtKey) {
    return keys.map(function (k, i) { return i === 0 || i === keys.length - 1 || i === hi ? fmtKey(k) : ""; });
  }

  // ---------- one card per chart ----------
  var cards = {

    "#vis_s1_types": function (v, e) {
      var type = v["Camera type"], dec = num(v["Decade made"]), sh = data.typeShare[type] || [];
      var i = data.decades.indexOf(dec), share = sh[i] || 0, peak = Math.max.apply(null, sh), pi = sh.indexOf(peak);
      return card(C.film, [
        kicker("Science Museum Group · made in the " + dec + "s"),
        title(e(type) + " cameras"),
        big(pct(share), " of the decade's cameras"),
        sub(e(v["Cameras"]) + " cameras in the collection"),
        bars(sh, edgeLabels(data.decades, i, function (d) { return d + "s"; }), i),
        note(i === pi ? "Its <b>peak decade</b> in the collection." : "Its peak: <b>" + pct(peak) + "</b> in the " + data.decades[pi] + "s."),
        v["What this shows"] ? '<p class="tt-why">' + e(v["What this shows"]) + "</p>" : ""
      ]);
    },

    "#vis_s1_flow": function (v, e) {
      if (v["Made in"] === undefined) {
        return card(C.film, [kicker("Museums Victoria · year made"), title(e(v["Years made"])), big(e(v["Cameras"]), " cameras"),
          note("Drag across the bars to show only these years on the map.")]);
      }
      var aus = v["Made in"] === "Australia";
      return card(aus ? C.aus : C.film, [
        kicker(aus ? "Made in Australia" : "Origin: where they were made"),
        title(e(v["Made in"])),
        big(e(v["Cameras"]), " cameras"),
        sub(e(v["Share of cameras"]) + " of the cameras shown · made " + e(v["Years made"])),
        note(aus ? "Most were made by <b>Kodak Australasia</b> in Melbourne." : "Each line ends at <b>Museums Victoria</b> in Melbourne.")
      ]);
    },

    "#vis_s2_exports": function (v, e) {
      var c = v["Country"], y = num(v["Year"]), yrs = data.cams.years, s = series(data.cams.value[c], yrs), i = yrs.indexOf(y);
      var now = s[i], then = s[0], aus = c === "Australia";
      var change = isFinite(then) && then > 0 && y !== 2000 ? (now < then ? "Down <b>" + pct(1 - now / then, 1 - now / then > 0.99 ? 1 : 0) + "</b> since 2000." : "Up <b>" + pct(now / then - 1) + "</b> since 2000.") : (y === 2000 ? "The last big year for film cameras." : "");
      return card(aus ? C.aus : C.film, [
        kicker("35mm film camera exports · " + y),
        title(e(c)),
        big(money(now), " exported"),
        sub("World rank #" + e(v["World rank"]) + (v["Cameras exported"] ? " · " + e(v["Cameras exported"]) + " cameras" : "")),
        line(s, i, "2000", "2023"),
        change ? note(change) : ""
      ]);
    },

    "#vis_s2_bump": function (v, e) {
      var c = v["Country"], y = num(v["Year"]), yrs = data.film.years, i = yrs.indexOf(y), aus = c === "Australia";
      var ranks = series(data.film.rank[c], yrs), r2000 = ranks[0];
      var inv = ranks.map(function (r) { return isFinite(r) ? 40 - r : NaN; });   // higher line = better rank
      return card(aus ? C.aus : C.grey, [
        kicker("Colour film exports · " + y),
        title(e(c)),
        big("#" + e(v["World rank"]), " in the world"),
        sub(money(num(v["Exports (US$ m)"])) + " of colour film exported"),
        line(inv, i, "2000", "2023"),
        note(y === 2000 ? "One of the <b>top 10</b> film exporters in 2000." : "Rank in 2000: <b>#" + r2000 + "</b>.")
      ]);
    },

    "#vis_s2_aus": function (v, e) {
      var yrs = data.film.years, y = num(v["Year"]), s = series(data.film.value.Australia, yrs), i = yrs.indexOf(y);
      return card(C.aus, [
        kicker("Australia · colour film exports"),
        title(String(y)),
        big(e(v["Colour film exports"])),
        line(s, i, "2000", "2023"),
        note(y === 2000 ? "Four years before Kodak's Coburg plant closed." : "<b>" + pct(1 - s[i] / s[0], 1) + "</b> below 2000.")
      ]);
    },

    "#vis_s3_brands": function (v, e) {
      var y = num(v["Year"]), i = data.years.indexOf(y);
      if (v["Brand"] === undefined) {
        var tot = data.years.map(function (k) { return data.yearTotal[k] || 0; });
        return card(C.digital, [kicker("All brands · " + y), title("New camera models"), big(e(v["New models, all brands"]), " new models"),
          bars(tot, edgeLabels(data.years, i, String), i), note(y === 2010 ? "The <b>peak year</b>." : "Peak: <b>340</b> models in 2010.")]);
      }
      var b = v["Brand"], s = data.years.map(function (k) { return (data.brandYear[b] || {})[k] || 0; });
      var peak = Math.max.apply(null, s), py = data.years[s.indexOf(peak)];
      return card(C.digital, [
        kicker("New models · " + y),
        title(e(b)),
        big(e(v["New models"]), " new models"),
        v["Share of all models that year"] ? sub(e(v["Share of all models that year"]) + " of all new models that year") : "",
        bars(s, edgeLabels(data.years, i, String), i),
        note(y === py ? "<b>" + e(b) + "'s busiest year.</b>" : "Busiest year: <b>" + py + "</b>, with " + peak + " models.")
      ]);
    },

    "#vis_s3_gantt": function (v, e) {
      var b = v["Brand"], s = data.years.map(function (k) { return (data.brandYear[b] || {})[k] || 0; });
      var by = num(v["Busiest year"]), i = data.years.indexOf(by), last = 0;
      s.forEach(function (n, j) { if (n > 0) last = data.years[j]; });
      return card(last >= 2023 ? C.digital : C.grey, [
        kicker(last >= 2023 ? "Still releasing models" : "Stopped releasing models"),
        title(e(b)),
        big(v["Models released"] ? e(v["Models released"]) : e(v["Models that year"]), v["Models released"] ? " models" : " models that year"),
        sub(v["Years with new models"] ? "New models " + e(v["Years with new models"]) : "Busiest year"),
        bars(s, edgeLabels(data.years, i, String), i),
        note("Busiest year: <b>" + by + "</b>, with " + e(v["Models that year"]) + " models.")
      ]);
    },

    "#vis_s3_weight": function (v, e) {
      var era = String(v["Era"]), parts = era.split(": ");
      var notes = { "1994": "Early digital cameras were often chunky.", "2005": "The lightest era: small pocket cameras.", "2013": "Pocket cameras faded; bigger cameras remain." };
      return card(C.digital, [kicker("Era " + e(parts[0])), title(e(parts[1] || era)), big(e(v["Median weight (g)"]) + " g", " median weight"),
        sub(e(v["Models with a weight"]) + " models with a listed weight"), note(notes[parts[0].slice(0, 4)] || "")]);
    },

    "#vis_s3_sensor": function (v, e) {
      var y = num(v["Year"]), s = data.sensor[y] || {}, tot = (s.CMOS + s.CCD + s["Other or unknown"]) || 1;
      return card(C.digital, [
        kicker("New camera models · " + y),
        title(e(v["Sensor"]) + " sensors"),
        big(e(v["Share of the year"]), " of new models"),
        sub(e(v["Models"]) + " of " + tot + " models"),
        mix([["CMOS", s.CMOS / tot, C.digital], ["CCD", s.CCD / tot, "#BFDCDF"], ["Other", s["Other or unknown"] / tot, "#E4E0D7"]]),
        note(y < 2012 ? "CMOS passes half of new models in <b>2012</b>." : "CMOS is the main sensor from <b>2012</b> on.")
      ]);
    },

    "#vis_s3_mp": function (v, e) {
      if (v["Median megapixels"] !== undefined) {
        return card(C.digital, [kicker("Typical new model"), title(e(v["Year"])), big(e(v["Median megapixels"]) + " MP", " median"),
          note("Drag across this chart to zoom the box plots.")]);
      }
      return null;   // the box plot's own statistics: use the plain card
    },

    "#vis_s4_phones": function (v, e) {
      var y = num(v["Year"]);
      if (v["Australia"] !== undefined) {
        var k = v["Australia"], yrs = []; for (var a = 1994; a <= 2024; a++) yrs.push(a);
        var s = series(data.ict[k], yrs), mob = k.indexOf("Mobile") === 0, val = num(v["Per 100 people"]);
        return card(mob ? C.phone : C.grey, [kicker("Australia · " + y), title(e(k)), big(fmt(val), " per 100 people"),
          line(s, yrs.indexOf(y), "1994", "2024"),
          note(mob ? (val >= 100 ? "More subscriptions than people." : "Fewer than one per person.") : "Home phones peaked at 53 per 100 in 2002.")]);
      }
      var tot = data.years.filter(function (k) { return k <= 2024; }).map(function (k) { return data.yearTotal[k] || 0; });
      return card(C.digital, [kicker("Worldwide · " + y), title("New camera models"), big(e(v["New camera models"]), " new models"),
        bars(tot, edgeLabels(data.years.slice(0, 31), data.years.indexOf(y), String), data.years.indexOf(y))]);
    },

    "#vis_s4_map": function (v, e) {
      var c = v["Country"], y = num(v["Year"]), yrs = [2019, 2020, 2021, 2022, 2023, 2024], s = series(data.own[c], yrs), aus = c === "Australia";
      var compare = aus ? "World: <b>" + fmt(data.own.World[y], 1) + "%</b>." : "Australia: <b>" + fmt(data.own.Australia[y], 1) + "%</b> · World: <b>" + fmt(data.own.World[y], 1) + "%</b>.";
      return card(aus ? C.aus : C.phone, [kicker("Own a mobile phone · " + y), title(e(c)), big(fmt(num(v["Own a mobile phone (%)"]), 1) + "%", " of people"),
        sub("Rank #" + e(v["Rank (of countries with data)"]) + " of countries with data"), line(s, yrs.indexOf(y), "2019", "2024"), note(compare)]);
    },

    "#vis_s4_waffle": function (v, e) {
      var p = num(v["Own a mobile phone (%)"]), aus = v["Where"] === "Australia";
      return card(aus ? C.aus : C.phone, [kicker("2024"), title(e(v["Where"])), big(fmt(p, 1) + "%", " own a mobile phone"),
        sub("About <b>" + Math.round(p) + " in 100</b> people"),
        mix([["Own one", p / 100, C.phone], ["Do not", 1 - p / 100, "#E4E0D7"]], 1)]);
    }
  };

  // Every other tooltip (and the box plot's statistics): the same card, as a small table.
  function plain(v, e, colour) {
    var rows = Object.keys(v).map(function (k) { return "<tr><th>" + e(k) + "</th><td>" + e(String(v[k])) + "</td></tr>"; }).join("");
    return card(colour || C.ink, ['<table class="tt-table">' + rows + "</table>"]);
  }
  var section = { s1: C.film, s2: C.film, s3: C.digital, s4: C.phone };

  // Options passed to vegaEmbed for one chart
  function options(id) {
    return {
      theme: "camera",
      formatTooltip: function (value, sanitize) {
        if (value === null || typeof value !== "object") return sanitize(String(value));
        var colour = section[id.slice(5, 7)];
        try {
          var html = data.ready && cards[id] ? cards[id](value, sanitize) : null;
          return html || plain(value, sanitize, colour);
        } catch (err) {
          console.error("Tooltip failed for " + id, err);
          return plain(value, sanitize, colour);
        }
      }
    };
  }

  load();
  return { options: options };
})();