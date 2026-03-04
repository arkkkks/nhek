(function () {
  function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function mixColor(color, target, amount) {
    var ratio = Math.max(0, Math.min(1, amount));
    return {
      r: clampChannel(color.r + (target.r - color.r) * ratio),
      g: clampChannel(color.g + (target.g - color.g) * ratio),
      b: clampChannel(color.b + (target.b - color.b) * ratio)
    };
  }

  function rgbString(color) {
    return "rgb(" + color.r + ", " + color.g + ", " + color.b + ")";
  }

  function relativeLuminance(color) {
    function toLinear(channel) {
      var value = channel / 255;
      if (value <= 0.04045) {
        return value / 12.92;
      }
      return Math.pow((value + 0.055) / 1.055, 2.4);
    }

    var r = toLinear(color.r);
    var g = toLinear(color.g);
    var b = toLinear(color.b);
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
  }

  function findDominantColor(imageEl) {
    if (!imageEl || !imageEl.naturalWidth || !imageEl.naturalHeight) {
      return null;
    }

    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    var sampleSize = 36;
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    try {
      context.drawImage(imageEl, 0, 0, sampleSize, sampleSize);
    } catch (error) {
      return null;
    }

    var data;
    try {
      data = context.getImageData(0, 0, sampleSize, sampleSize).data;
    } catch (error) {
      return null;
    }

    var buckets = new Map();
    var rawR = 0;
    var rawG = 0;
    var rawB = 0;
    var rawWeight = 0;

    for (var i = 0; i < data.length; i += 4) {
      var alpha = data[i + 3];
      if (alpha < 90) {
        continue;
      }

      var r = data[i];
      var g = data[i + 1];
      var b = data[i + 2];

      rawR += r;
      rawG += g;
      rawB += b;
      rawWeight += 1;

      var max = Math.max(r, g, b);
      var min = Math.min(r, g, b);
      var lightness = (max + min) / 510;
      if (lightness < 0.08 || lightness > 0.96) {
        continue;
      }

      var saturation = max === 0 ? 0 : (max - min) / max;
      var weight = 1 + (saturation * 2);
      var qR = Math.floor(r / 24) * 24;
      var qG = Math.floor(g / 24) * 24;
      var qB = Math.floor(b / 24) * 24;
      var key = qR + "," + qG + "," + qB;
      var entry = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0 };

      entry.weight += weight;
      entry.r += r * weight;
      entry.g += g * weight;
      entry.b += b * weight;
      buckets.set(key, entry);
    }

    var bestBucket = null;
    buckets.forEach(function (bucket) {
      if (!bestBucket || bucket.weight > bestBucket.weight) {
        bestBucket = bucket;
      }
    });

    if (bestBucket && bestBucket.weight > 0) {
      return {
        r: clampChannel(bestBucket.r / bestBucket.weight),
        g: clampChannel(bestBucket.g / bestBucket.weight),
        b: clampChannel(bestBucket.b / bestBucket.weight)
      };
    }

    if (rawWeight > 0) {
      return {
        r: clampChannel(rawR / rawWeight),
        g: clampChannel(rawG / rawWeight),
        b: clampChannel(rawB / rawWeight)
      };
    }

    return null;
  }

  function applyCoverPalette(color) {
    if (!color) {
      return;
    }

    var light = mixColor(color, { r: 255, g: 255, b: 255 }, 0.28);
    var dark = mixColor(color, { r: 0, g: 0, b: 0 }, 0.3);
    var text = relativeLuminance(color) > 0.42 ? "#2a1a10" : "#fffaf0";

    document.documentElement.style.setProperty("--cover-base", rgbString(color));
    document.documentElement.style.setProperty("--cover-light", rgbString(light));
    document.documentElement.style.setProperty("--cover-dark", rgbString(dark));
    document.documentElement.style.setProperty("--cover-text", text);
  }

  function syncCoverPalette() {
    var coverImage = document.querySelector(".cover-front .cover-image");
    if (!coverImage) {
      return;
    }

    function updatePalette() {
      applyCoverPalette(findDominantColor(coverImage));
    }

    if (coverImage.complete && coverImage.naturalWidth > 0) {
      updatePalette();
      return;
    }

    coverImage.addEventListener("load", updatePalette, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncCoverPalette, { once: true });
  } else {
    syncCoverPalette();
  }
})();
