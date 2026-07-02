// Renders the screenshot gallery from JSON the capture lane writes (clients.json / manifest.json).
// One script serves both pages; body[data-view] selects which. No external dependencies.
(function () {
  "use strict";

  var view = document.body.dataset.view;
  if (view === "root") renderRoot();
  else if (view === "client") renderClient();

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "text") node.textContent = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (child) { node.appendChild(child); });
    return node;
  }

  function fail(message) {
    document.getElementById("app").innerHTML = "";
    document.getElementById("app").appendChild(el("p", { class: "error", text: message }));
  }

  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  // Root: list every published client.
  function renderRoot() {
    getJSON("clients.json").then(function (data) {
      var clients = data.clients || [];
      var app = document.getElementById("app");
      app.innerHTML = "";
      if (!clients.length) { fail("No clients published yet."); return; }
      var list = el("ul", { class: "client-list" });
      clients.forEach(function (name) {
        var link = el("a", {
          class: "client-card",
          href: "client.html?c=" + encodeURIComponent(name),
          text: name
        });
        list.appendChild(el("li", null, [link]));
      });
      app.appendChild(list);
    }).catch(function () { fail("Could not load the client list."); });
  }

  // Client: per-platform grids, each with a "Download all" zip; thumbnails open a lightbox.
  function renderClient() {
    var client = new URLSearchParams(location.search).get("c");
    if (!client) { fail("No client specified."); return; }
    document.getElementById("title").textContent = client;
    document.title = client + " — screenshots";
    setupLightbox();

    getJSON(encodeURIComponent(client) + "/manifest.json").then(function (manifest) {
      var platforms = manifest.platforms || {};
      var names = Object.keys(platforms);
      var app = document.getElementById("app");
      app.innerHTML = "";
      if (!names.length) { fail("No screenshots for this client yet."); return; }

      names.forEach(function (platform) {
        var info = platforms[platform];
        var images = info.images || [];

        var head = el("div", { class: "platform-head" }, [el("h2", { text: platform })]);
        if (info.zip) {
          head.appendChild(el("a", {
            class: "btn",
            download: "",
            href: client + "/" + info.zip,
            text: "Download all (" + images.length + ")"
          }));
        }

        var section = el("section", { class: "platform" }, [head]);
        // Label each device with a sub-header. iOS splits into iPhone/iPad from the filenames; a
        // single-device platform (e.g. Android) has no device in its paths, so fall back to the
        // manifest's `device` (the emulator the lane booted) to stay explicit.
        var groups = groupByDevice(images);
        groups.forEach(function (group) {
          var label = (groups.length === 1 && info.device) ? info.device : group.label;
          if (label) section.appendChild(el("h3", { class: "device", text: label }));
          var grid = el("div", { class: "grid" });
          group.items.forEach(function (image) {
            var src = client + "/" + image;
            var thumb = el("img", { loading: "lazy", src: src, alt: image });
            thumb.addEventListener("click", function () { openLightbox(src); });
            var download = el("a", { class: "shot-dl", download: "", href: src, title: "Download", text: "↓" });
            grid.appendChild(el("figure", { class: "shot" }, [thumb, download]));
          });
          section.appendChild(grid);
        });

        app.appendChild(section);
      });
    }).catch(function () { fail("Could not load screenshots for this client."); });
  }

  // Splits a platform's images into ordered device groups. iOS shots are named "<device>-NN-slug.png"
  // (snapshot); Android shots live under ".../<kind>Screenshots/..." (screengrab). Returns
  // [{label, items}] preserving first-seen order; label is "" when a device can't be inferred.
  function deviceLabel(path) {
    var name = path.split("/").pop();
    var ios = name.match(/^(.*?)-\d{2}-/);
    if (ios) return ios[1];
    var kind = path.match(/\/(\w+?)Screenshots\//i);
    if (kind) {
      var map = { phone: "Phone", tablet: "Tablet", seveninch: "7-inch tablet", teninch: "10-inch tablet" };
      return map[kind[1].toLowerCase()] || kind[1];
    }
    return "";
  }

  function groupByDevice(images) {
    var order = [], buckets = {};
    images.forEach(function (image) {
      var label = deviceLabel(image);
      if (!(label in buckets)) { buckets[label] = []; order.push(label); }
      buckets[label].push(image);
    });
    return order.map(function (label) { return { label: label, items: buckets[label] }; });
  }

  function setupLightbox() {
    var box = document.getElementById("lightbox");
    if (!box) return;
    box.querySelector(".lb-close").addEventListener("click", closeLightbox);
    box.addEventListener("click", function (e) { if (e.target === box) closeLightbox(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLightbox(); });
  }

  function openLightbox(src) {
    var box = document.getElementById("lightbox");
    box.querySelector("#lb-img").src = src;
    box.querySelector(".lb-download").href = src;
    box.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeLightbox() {
    var box = document.getElementById("lightbox");
    box.hidden = true;
    box.querySelector("#lb-img").src = "";
    document.body.classList.remove("no-scroll");
  }
})();
