var LateralMap = (function() {

    var Map = function() {
        this.data = 10;
    };

    Map.prototype.render = function(graph, element) {
        var font_size = 15,
            text_length = 15,
            margin = {
                top: 50,
                right: 75,
                bottom: 0,
                left: 40
            },
            width = 1200,
            highlighted = false;
            height = 1100; //TODO redo

        graph.nodes.forEach(function(d) {
            d.height = 20;
            d.width = Math.min(text_length, d.value.length) * 10 + 2;
        });


        d3.select(element).select('svg').remove();
        var svg = d3.select(element).append("svg").attr("width", width)
            .attr("height", height);
        var holder = svg.append("g");

        svg.append('svg:defs').append('svg:marker')
            .attr('id', 'mid-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', -10)
            .attr('markerWidth', 3)
            .attr('markerHeight', 3)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#000');

        svg.call(d3.zoom()
            .scaleExtent([1 / 5, 20])
            .on("zoom", zoomed));

        function zoomed() {
            holder.attr("transform", d3.event.transform);
            nodelabels.style("font-size", font_size / d3.event.transform.k);
            edgelabels.style("font-size", font_size / d3.event.transform.k);
            nodes.attr("width", function(d) {
                    return d.width / d3.event.transform.k
                    })
                .attr("height", function(d) {
                        return d.height / d3.event.transform.k
                    })
                .attr("zoom", d3.event.transform.k);
            ticked(); //because transform is broken with text
        }
        simulation = d3.forceSimulation(graph.nodes).on("tick", ticked)
            .force("link", d3.forceLink(graph.links)
                .id(function(d) {
                    return d.id;
                })
                //.distance(function(d) {
                //    return link_distance(d);
                //})
                .strength(function(d) {
                    return link_strength(d);
                })
            )
            .force("charge", d3.forceManyBody()
                .distanceMax(1000)
                .strength(-200))
            .force("centering", d3.forceCenter(width / 2, height / 2))
            .force("circular", circular(width / 2, height / 2, 400));

        var glinks = holder.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graph.links)
            .enter().append("g")
            .attr("class", "link")
            .attr("id", function(d){return "glink_"+d.index;});

        var links = glinks.append("line")
            .attr("stroke", link_color)
            .attr("stroke-opacity", 0.5)
            .style('marker-start', function(d) {
                return d.type == "access" ? 'url(#mid-arrow)' : "";
            })
            .attr("stroke-width", function(d) {
                return 2;
            })
            .on("click", function(d) {
                console.log(d);

                for (var e in d.events) {
                    //console.log(d.events[e]);
                }
            });


        var edgelabels = glinks.append('text')
            .text(function(d) {
                return d.events.length;
            })
            .style("opacity", 0.5)
            .style("font-size", font_size)
            .attr('class', 'edgelabel');

        var gnodes = holder.append("g")
            .attr("class", "nodes")
            .selectAll(".node")
            .data(graph.nodes)
            .enter()
            .append("g")
            .attr("id",function(d){return "gnode_"+d.id;})
            .attr("class", "node")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        var nodes = gnodes.append("rect")
            .attr("width", function(d) {
                return d.width;
            }) //TODO getComputedTextLength()
            .attr("height", function(d) {
                return d.height;
            })
            .style("opacity", 0.5)
            .style("fill", node_color)

            .on("click", function(d) {
                if (highlighted){
                    reset();
                }
                else{
                    var set = has_is_dfs(d);

                    glinks.style("opacity", 0.1);
                    graph.links.forEach(function(d){
                        var glink = d3.select("#glink_"+d.index);
                        if(set.has(d.source.id) || set.has(d.target.id)){
                            glink.style("opacity", 1);
                        }
                    });

                    gnodes.style("opacity",0.1);
                    select_by_id(nodes, set).each(function(d){
                        d3.select(this.parentNode).style("opacity",1);
                    });

                    var sshset = access_dfs(set);
                    select_by_id(nodes, sshset).each(function(d){
                        d3.select(this)
                            .style("stroke", "black")
                            .style("stroke-width", 1)
                        d3.select(this.parentNode)
                            .style("opacity",1);
                    });


                }
                highlighted =! highlighted;

            })
            .on("mouseover", function(d){
                d3.select(this.parentNode).select("text")
                    .attr("old_text", function(d){
                        return this.textContent;
                    })
                    .text(d.value);
            })
            .on("mouseout", function(d){
                d3.select(this.parentNode).select("text")
                    .text(function(d){
                        return d3.select(this).attr("old_text");
                });
            })

            ;
        var nodelabels = gnodes.append("text")
            .style("font-size", font_size)
            .style("font-family","monospace")
            .style("pointer-events", "none")
            .text(function(d) {
                var text = d.value;

                if (text.length <= text_length) {
                    return text;
                } else {
                    return text.slice(0, text_length-3) + "...";
                }
            })
            .style("fill", "black");
        function reset(){
            nodes.style("stroke-width", 0)
            glinks.style("opacity", 1);
            gnodes.style("opacity",1);
        }
        function ticked() {
            var i = 0,
                n = graph.nodes.length;
            var q = d3.quadtree()
                .x(function(d) {
                    return d.x;
                })
                .y(function(d) {
                    return d.y;
                })
                .addAll(graph.nodes);
            while (++i < n) {
                q.visit(collide(graph.nodes[i]));
            }

            //moving
            links
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
            nodes
                .attr("x", function(d) {
                    return d.x;
                })
                .attr("y", function(d) {
                    return d.y;
                });
            nodelabels
                .attr("x", function(d) {
                    var rect_width = d3.select(this.parentNode).select("rect").attr("width");

                    return d.x + rect_width * 0.03;
                })
                .attr("y", function(d) {
                    var rect_height = d3.select(this.parentNode).select("rect").attr("height");
                    return d.y + rect_height * 0.85;
                });
            edgelabels
                .attr("x", function(d) {
                    return (d.source.x + d.target.x) / 2;
                })
                .attr("y", function(d) {
                    return (d.source.y + d.target.y) / 2;
                });

            //inheriting opacity
            //glinks.style("opacity", function(d){console.log(d); return 1;});

        }

        function dragstarted(d) {
            if (!d3.event.active) simulation.alphaTarget(0.01).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(d) {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        }

        function dragended(d) {
            if (!d3.event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        function select_by_id(selection, id_set){
            return selection.filter( function(d){ return id_set.has(d.id);} );
        }
        var G = new Array(graph.nodes.length);
        for (var i = 0; i < graph.nodes.length; i++) {
            G[i] = new Array();
        }
        for (var i = 0; i<graph.links.length; i++){
            var link = graph.links[i];
            G[link.source.id].push(link);
            G[link.target.id].push(link);
        }
        function has_is_dfs(d){
            var done = new Set();
            var edge_types = ["has","is"]
            var dfs = function(node){
                if (done.has(node)) return;
                done.add(node);
                for (var i=0; i< G[node].length; i++){
                    var link = G[node][i];
                    if(edge_types.indexOf(link.type)!==-1){
                        dfs(link.source.id);
                        dfs(link.target.id);
                    }
                }
            }
            if(d instanceof Array){
                for(var i=0; i< d.length ; i++){
                    dfs(d[i].id);
                }
            }
            else{
                dfs(d.id);
            }
            return done;
        }

        function access_dfs(d){
            var done = new Set();
            var _d = d;
            d = Array.from(d);
            for(var i=0; i<d.length ; i++){
                for(var j=0; j< G[d[i]].length; j++){
                    var link = G[d[i]][j];

                    if(link.type == "access"){
                        done.add(link.source.id);
                        done.add(link.target.id);
                    }
                }
            }
            for(var i=0; i<d.length ; i++){
                done.delete(d[i]);
            }
            return done;
        }

    };

    function collide(node) {
        return function(tree, x1, y1, x2, y2) {
            var nx1 = node.x,
                ny1 = node.y,
                nx2 = node.x + node.width,
                ny2 = node.y + node.height;
            var left = Math.min(x1, nx1, x2, nx2),
                right = Math.max(x1, nx1, x2, nx2),
                up = Math.min(y1, ny1, y2, ny2),
                down = Math.max(y1, ny1, y2, ny2);
            var xPadding = 0,
                yPadding = 0;
            var xSize = (x2 - x1) + (nx2 - nx1) + xPadding,
                ySize = (y2 - y1) + (ny2 - ny1) + yPadding;

            if (right - left < xSize && down - up < ySize) { //TODO redo me
                if ("data" in tree && (tree.data !== node)) {
                    var point = tree.data;
                    var x = node.x - point.x,
                        y = node.y - point.y,
                        xSpacing = (point.width + node.width) / 2 + xPadding,
                        ySpacing = (point.height + node.height) / 2 + yPadding,
                        absX = Math.abs(x),
                        absY = Math.abs(y),
                        l,
                        lx,
                        ly;

                    if (absX < xSpacing && absY < ySpacing) {
                        l = Math.sqrt(x * x + y * y);

                        lx = (absX - xSpacing) / l;
                        ly = (absY - ySpacing) / l;

                        // the one that's barely within the bounds probably triggered the collision
                        if (Math.abs(lx) > Math.abs(ly)) {
                            lx = 0;
                        } else {
                            ly = 0;
                        }

                        node.x -= x *= lx;
                        node.y -= y *= ly;
                        point.x += x;
                        point.y += y;

                        return true;
                    }
                }
                return false;
            } else {
                return true;
            }
        };
    }

    function circular(x, y, r) {
        var nodes,
            alpha;
        if (x == null) x = 0;
        if (y == null) y = 0;
        if (r == null) r = 200;

        function force(_) {
            var i, n = nodes.length,
                radius, dx, dy, ratio, upr = r*1.1, downr = r*0.9, rr;
            for (alpha = _, i = 0; i < n; ++i) {

                dx = nodes[i].x - x;
                dy = nodes[i].y - y;
                radius = Math.sqrt(dx * dx + dy * dy)
                if (radius < 1) radius = 1;

                if (nodes[i].type == "machine_name" || nodes[i].type == "machine_ip") {
                    if(radius < downr){
                        rr = downr;
                    }
                    else if(upr < radius){
                        rr = upr;
                    }
                    else continue;

                    ratio = (rr - radius) / rr;
                    if (0 < ratio && ratio < 0.5) ratio = ratio * ratio;
                    nodes[i].vx += ratio * dx;
                    nodes[i].vy += ratio * dy;
                }
            }
        }

        force.initialize = function(_) {
            nodes = _;
        };

        return force;
    }

    function node_color(node) {
        var maper = {
            "machine_name": d3.schemeCategory20[1],
            "ip": d3.schemeCategory20[3],
            "user_name": d3.schemeCategory20[5],
            "user_id": d3.schemeCategory20[7]
        }
        if (node.type in maper) {
            return maper[node.type];
        } else {
            return d3.color("orange");
        }
    }

    function link_distance(link) {
        var maper = {
            "has": 10,
            "is": 10,
            "access": 500,
        }
        if (link.type in maper) {
            return maper[link.type];
        } else {
            return 200;
        }
    }

    function link_strength(link) {
        var maper = {
            "has": 1,
            "is": 1,
            "access": 0.1,
        }
        console.log(maper[link.type]);
        return maper[link.type];
        if (link.type in maper) {
            return maper[link.type];
        } else {
            return 1;
        }
    }

    function link_color(link) {
        var maper = {
            "is": d3.color("red"),
            "has": d3.color("blue"),
            "access": d3.color("green"),
        }
        if (link.type in maper) {
            return maper[link.type];
        } else {
            return d3.color("orange");
        }
    }

    var exports = {}
    exports.Map = Map;
    return exports;
}());