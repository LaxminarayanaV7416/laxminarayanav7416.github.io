$(document).ready(function () {
  // Variables
  var $codeSnippets = $('.code-example-body'),
      $nav = $('.navbar'),
      $body = $('body'),
      $window = $(window),
      $popoverLink = $('[data-popover]'),
      navOffsetTop = $nav.offset().top,
      $document = $(document),
      entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': '&quot;',
        "'": '&#39;',
        "/": '&#x2F;'
      }

  function init() {
    $window.on('scroll', onScroll)
    $window.on('resize', resize)
    $popoverLink.on('click', openPopover)
    $document.on('click', closePopover)
    $('a[href^="#"]').on('click', smoothScroll)
    buildSnippets();
  }

  function smoothScroll(e) {
    e.preventDefault();
    $(document).off("scroll");
    var target = this.hash,
        menu = target;
    $target = $(target);
    $('html, body').stop().animate({
        'scrollTop': $target.offset().top-40
    }, 0, 'swing', function () {
        window.location.hash = target;
        $(document).on("scroll", onScroll);
    });
  }

  function openPopover(e) {
    e.preventDefault()
    closePopover();
    var popover = $($(this).data('popover'));
    popover.toggleClass('open')
    e.stopImmediatePropagation();
  }

  function closePopover(e) {
    if($('.popover.open').length > 0) {
      $('.popover').removeClass('open')
    }
  }

  $("#button").click(function() {
    $('html, body').animate({
        scrollTop: $("#elementtoScrollToID").offset().top
    }, 2000);
});

  function resize() {
    $body.removeClass('has-docked-nav')
    navOffsetTop = $nav.offset().top
    onScroll()
  }

  function onScroll() {
    if(navOffsetTop < $window.scrollTop() && !$body.hasClass('has-docked-nav')) {
      $body.addClass('has-docked-nav')
    }
    if(navOffsetTop > $window.scrollTop() && $body.hasClass('has-docked-nav')) {
      $body.removeClass('has-docked-nav')
    }
  }

  function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
  }

  function buildSnippets() {
    $codeSnippets.each(function() {
      var newContent = escapeHtml($(this).html())
      $(this).html(newContent)
    })
  }

  function initGraph(graph_starter = "skills-graph") {
    var graphContainer = document.getElementById(`${graph_starter}`);
    var nodesScript = document.getElementById(`${graph_starter}-nodes`);
    var linksScript = document.getElementById(`${graph_starter}-links`);
    var groupsScript = document.getElementById(`${graph_starter}-groups`);

    if (!graphContainer || !nodesScript || !linksScript || typeof d3 === "undefined") {
      return;
    }

    var nodes = JSON.parse(nodesScript.textContent);
    var links = JSON.parse(linksScript.textContent);
    var groups = JSON.parse(groupsScript.textContent);

    var groupDomain = groups.map(function(d) { return d.name; });
    var groupColors = groups.map(function(d) { return d.color; });

    if (!nodes.length) {
      graphContainer.innerHTML = "<p>No collaboration graph data found.</p>";
      return;
    }

    var width = graphContainer.clientWidth || 800;
    var height = window.innerWidth < 550 ? 420 : 520;

    var color = d3.scaleOrdinal()
      .domain(groupDomain)
      .range(groupColors);

    var svg = d3.select(graphContainer)
      .append("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("role", "img")
      .attr("aria-label", "Collaboration graph");

    var zoomLayer = svg.append("g");

    var linkLayer = zoomLayer.append("g")
      .attr("class", "graph-links");

    var labelLayer = zoomLayer.append("g")
      .attr("class", "graph-link-labels");

    var nodeLayer = zoomLayer.append("g")
      .attr("class", "graph-nodes");

    var tooltip = d3.select(graphContainer)
      .append("div")
      .attr("class", "skills-graph-tooltip");

    var zoom = d3.zoom()
      .scaleExtent([0.45, 3])
      .on("zoom", function(event) {
        zoomLayer.attr("transform", event.transform);
      });

    svg.call(zoom);

    var link = linkLayer
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "graph-link")
      .attr("stroke-width", function(d) {
        return Math.max(1, d.weight || 1);
      })
      .on("mousemove", function(event, d) {
        showTooltip(event, "<strong>" + escapeTooltip(d.label || "Connection") + "</strong><span>" +
          escapeTooltip(getNodeName(d.source)) + " → " + escapeTooltip(getNodeName(d.target)) +
          "</span>");
      })
      .on("mouseleave", hideTooltip);

    var linkLabel = labelLayer
      .selectAll("text")
      .data(links.filter(function(d) {
        return d.label;
      }))
      .enter()
      .append("text")
      .attr("class", "graph-link-label")
      .attr("text-anchor", "middle")
      .text(function(d) {
        return d.label;
      });

    var node = nodeLayer
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "graph-node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      )
      .on("mousemove", function(event, d) {
        var html = "<strong>" + escapeTooltip(d.name) + "</strong>";

        if (d.role) {
          html += "<span>" + escapeTooltip(d.role) + "</span><br>";
        }

        if (d.group) {
          html += "<span>Type: " + escapeTooltip(d.group) + "</span>";
        }

        showTooltip(event, html);
      })
      .on("mouseleave", hideTooltip)
      .on("click", function(event, d) {
        if (d.url) {
          window.open(d.url, "_blank");
        }
      });

    node.append("circle")
      .attr("r", function(d) {
        return d.primary ? 17 : 11;
      })
      .attr("fill", function(d) {
        return color(d.group || "Collaborator");
      });

    node.append("text")
      .attr("x", 15)
      .attr("y", 4)
      .text(function(d) {
        return d.name;
      });

    var simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id(function(d) {
          return d.id;
        })
        .distance(function(d) {
          return d.weight && d.weight >= 3 ? 95 : 125;
        })
      )
      .force("charge", d3.forceManyBody().strength(-380))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(function(d) {
        return d.primary ? 42 : 32;
      }))
      .on("tick", ticked);

    buildLegend();

    $(`#${graph_starter}-reset`).on("click", function() {
      svg.transition()
        .duration(300)
        .call(zoom.transform, d3.zoomIdentity);

      simulation.alpha(0.6).restart();
    });

    function ticked() {
      link
        .attr("x1", function(d) {
          return d.source.x;
        })
        .attr("y1", function(d) {
          return d.source.y;
        })
        .attr("x2", function(d) {
          return d.target.x;
        })
        .attr("y2", function(d) {
          return d.target.y;
        });

      linkLabel
        .attr("x", function(d) {
          return (d.source.x + d.target.x) / 2;
        })
        .attr("y", function(d) {
          return (d.source.y + d.target.y) / 2;
        });

      node.attr("transform", function(d) {
        return "translate(" + d.x + "," + d.y + ")";
      });
    }

    function dragstarted(event, d) {
      if (!event.active) {
        simulation.alphaTarget(0.3).restart();
      }

      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) {
        simulation.alphaTarget(0);
      }

      d.fx = null;
      d.fy = null;
    }

    function showTooltip(event, html) {
      tooltip
        .style("display", "block")
        .style("left", event.offsetX + 14 + "px")
        .style("top", event.offsetY + 14 + "px")
        .html(html);
    }

    function hideTooltip() {
      tooltip.style("display", "none");
    }

    function getNodeName(nodeOrId) {
      if (typeof nodeOrId === "object") {
        return nodeOrId.name || nodeOrId.id;
      }

      var match = nodes.find(function(node) {
        return node.id === nodeOrId;
      });

      return match ? match.name : nodeOrId;
    }

    function buildLegend() {
      var legendContainer = document.getElementById(`${graph_starter}-legend`);

      if (!legendContainer) {
        return;
      }

      var groups = Array.from(new Set(nodes.map(function(node) {
        return node.group || "Collaborator";
      }))).sort();

      legendContainer.innerHTML = "";

      groups.forEach(function(group) {
        var item = document.createElement("span");
        item.className = `${graph_starter}-legend-item`;

        var swatch = document.createElement("span");
        swatch.className = `${graph_starter}-legend-swatch`;
        swatch.style.backgroundColor = color(group);

        var label = document.createElement("span");
        label.textContent = group;

        item.appendChild(swatch);
        item.appendChild(label);
        legendContainer.appendChild(item);
      });
    }

    function escapeTooltip(value) {
      return String(value || "").replace(/[&<>"'\/]/g, function(s) {
        return entityMap[s];
      });
    }
  }

  function initThemeToggle() {
    var themeToggle = document.getElementById("theme-toggle");

    if (!themeToggle) {
      return;
    }

    var root = document.documentElement;
    var icon = themeToggle.querySelector(".theme-toggle-icon");
    var text = themeToggle.querySelector(".theme-toggle-text");

    function applyTheme(theme) {
      root.setAttribute("data-theme", theme);
      localStorage.setItem("site-theme", theme);

      var isDark = theme === "dark";
      themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");

      if (icon) {
        icon.textContent = isDark ? "☀" : "☾";
      }

      if (text) {
        text.textContent = isDark ? "Light" : "Dark";
      }
    }

    var currentTheme = root.getAttribute("data-theme") || "light";
    applyTheme(currentTheme);

    themeToggle.addEventListener("click", function () {
      var nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
    });
  }


  init();
  initThemeToggle();
  initGraph("collaboration-graph");
  initGraph("skills-graph");

});
