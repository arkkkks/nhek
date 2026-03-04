(function () {
    "use strict";

    var pageConfig = window.CAUSE_PAGE || {};
    var holder = document.getElementById("causesHolder");
    var heading = document.getElementById("pageHeading");
    var circle = document.querySelector(".circle-container");
    var particlesLayer = document.getElementById("ambientParticles");

    if (!holder || !heading || !circle) {
        return;
    }

    var causes = Array.isArray(pageConfig.causes) ? pageConfig.causes.slice() : [];
    if (!causes.length) {
        heading.textContent = "No causes available";
        return;
    }

    if (pageConfig.title) {
        document.title = pageConfig.title;
    }

    heading.textContent = pageConfig.heading || pageConfig.title || "Causes";

    function renderCauses() {
        holder.innerHTML = "";

        causes.forEach(function (item, index) {
            var link = document.createElement("a");
            link.className = "cause nav-link";
            link.href = item.href;
            link.textContent = item.text;
            link.setAttribute("data-tone", String(index % 6));
            link.style.setProperty("--i", String(index));
            link.style.transitionDelay = String(index * 52) + "ms";
            holder.appendChild(link);

            requestAnimationFrame(function () {
                link.classList.add("is-visible");
            });
        });

        positionCauses();
    }

    function positionCauses() {
        var cards = holder.querySelectorAll(".cause");
        if (!cards.length) {
            return;
        }

        var total = cards.length;
        var width = circle.clientWidth;
        var height = circle.clientHeight;
        var centerX = width / 2;
        var centerY = height / 2;
        var compact = window.matchMedia("(max-width: 620px)").matches;

        // Size cards from arc spacing so neighboring cards do not touch.
        var baseRadius = Math.min(width, height) * (compact ? 0.33 : 0.37);
        var arcSpacing = (2 * Math.PI * baseRadius) / total;
        var minCardWidth = compact ? 66 : 84;
        var maxCardWidthLimit = compact ? 112 : 138;
        var targetCardWidth = Math.max(minCardWidth, Math.min(maxCardWidthLimit, arcSpacing * 0.82));
        cards.forEach(function (card) {
            card.style.width = targetCardWidth.toFixed(1) + "px";
            card.style.minHeight = (targetCardWidth * (compact ? 0.72 : 0.62)).toFixed(1) + "px";
        });

        var maxCardWidth = 0;
        var maxCardHeight = 0;
        cards.forEach(function (card) {
            maxCardWidth = Math.max(maxCardWidth, card.offsetWidth || 0);
            maxCardHeight = Math.max(maxCardHeight, card.offsetHeight || 0);
        });

        var cardWidth = maxCardWidth || 140;
        var cardHeight = maxCardHeight || 90;
        var cardHalfDiagonal = Math.max(cardWidth, cardHeight) * 0.56;
        var safeMargin = compact ? 8 : 12;
        var fitRadius = (Math.min(width, height) / 2) - cardHalfDiagonal - safeMargin;
        var fallbackRadius = Math.min(width, height) * (compact ? 0.16 : 0.2);
        var maxSafeRadius = (Math.min(width, height) / 2) - cardHalfDiagonal - 4;
        var radius = Math.max(fitRadius, fallbackRadius);
        radius = Math.min(radius, Math.max(maxSafeRadius, 0));

        cards.forEach(function (card, index) {
            var angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / total);
            var x = centerX + radius * Math.cos(angle);
            var y = centerY + radius * Math.sin(angle);
            card.style.left = x + "px";
            card.style.top = y + "px";
        });
    }

    function addParticles() {
        if (!particlesLayer) {
            return;
        }

        particlesLayer.innerHTML = "";
        for (var i = 0; i < 18; i += 1) {
            var p = document.createElement("span");
            p.className = "ambient-particle";
            p.style.setProperty("--size", (4 + Math.random() * 13).toFixed(2) + "px");
            p.style.setProperty("--x", (Math.random() * 100).toFixed(2) + "%");
            p.style.setProperty("--delay", (Math.random() * 15).toFixed(2) + "s");
            p.style.setProperty("--dur", (11 + Math.random() * 16).toFixed(2) + "s");
            particlesLayer.appendChild(p);
        }
    }

    function addDepthMotion() {
        var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducedMotion) {
            return;
        }

        circle.addEventListener("pointermove", function (event) {
            var rect = circle.getBoundingClientRect();
            var x = ((event.clientX - rect.left) / rect.width) - 0.5;
            var y = ((event.clientY - rect.top) / rect.height) - 0.5;
            var rotateY = x * 3.4;
            var rotateX = -y * 3.4;
            circle.style.transform = "perspective(900px) rotateX(" + rotateX.toFixed(2) + "deg) rotateY(" + rotateY.toFixed(2) + "deg)";
        });

        circle.addEventListener("pointerleave", function () {
            circle.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
        });
    }

    var transitionLock = false;
    var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function pulseClickedLink(link) {
        if (!link) {
            return;
        }

        link.classList.remove("nav-clicked");
        void link.offsetWidth;
        link.classList.add("nav-clicked");
    }

    function navigateWithTransition(href, link) {
        if (transitionLock) {
            return;
        }

        transitionLock = true;

        if (prefersReducedMotion) {
            document.body.classList.add("page-leaving");
            window.setTimeout(function () {
                window.location.href = href;
            }, 120);
            return;
        }

        pulseClickedLink(link);

        window.setTimeout(function () {
            document.body.classList.add("page-leaving");
        }, 90);

        window.setTimeout(function () {
            window.location.href = href;
        }, 500);
    }

    document.addEventListener("click", function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        var link = event.target.closest("a.nav-link, a.cause");
        if (!link) {
            return;
        }

        var href = link.getAttribute("href");
        if (!href || href.indexOf("#") === 0) {
            return;
        }

        event.preventDefault();
        navigateWithTransition(href, link);
    });

    renderCauses();
    addParticles();
    addDepthMotion();
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(positionCauses);
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(positionCauses, 90);
    });
})();
