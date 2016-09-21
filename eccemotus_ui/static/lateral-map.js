var LateralMap = (function() {

    var Map = function() {};
    Map.prototype.set_data = function(data) {
        /* Makes revertible data manipulation possible. */
        // Permanent copy of data.
        this.backup_data = JSON.parse(JSON.stringify(data));
        // Working data.
        this.graph = JSON.parse(JSON.stringify(data));
    }

    Map.prototype.reset = function() {
        /* Reset working data to initial data. */
        this.graph = JSON.parse(JSON.stringify(this.backup_data));
    }

    Map.prototype.set_forces = function() {
        /* Set up simulation forces that control positions of elements. */
        var _this = this;
        this.simulation = d3.forceSimulation(this.graph.nodes).on('tick', function() {
                _this.tick();
            })
            .force('link', d3.forceLink(this.graph.links)
                .id(function(d) {
                    return d.id;
                })
                .strength(function(d) {
                    return link_strength(d);
                })
            )
            .force('charge', d3.forceManyBody()
                .distanceMax(500)
                .strength(-200))
            .force('centering', d3.forceCenter(this.width / 2, this.height / 2))
            .force('circular', circular(this.width / 2, this.height / 2, 500)).stop();
    }

    Map.prototype.set_elements = function() {
        /* Create d3 element and link them to data. */
        var _this = this;
        this.holder.selectAll('*').remove();
        this.glinks = this.holder.append('g')
            .attr('class', 'links')
            .selectAll()
            .data(graph.links)
            .enter().append('g')
                .attr('class', 'link')
                .attr('id', function(d) {
                    return 'glink_' + d.index;
                });

        this.links = this.glinks.append('line')
            .attr('stroke', link_color)
            .attr('stroke-opacity', 0.5)
            .style('marker-start', function(d) {
                return d.type == 'access' ? 'url(#mid-arrow)' : '';
            })
            .attr('stroke-width', 3)
            .on('click', function(d) {
                console.log(d);
                for(var e in d.events) {
                    //console.log(d.events[e]);
                }
            })
            .on('mouseover', function(d) {
                glink = d3.select(this.parentNode);
                var line = glink.select('line');
                var current = line.attr('stroke-width').replace('px', '');
                line.attr('stroke-width', current*2);
                var text = glink.select('text');
                var current = text.style('font-size').replace('px', '');
                text.style('font-size', current*2);
            })
            .on('mouseout', function(d) {
                glink = d3.select(this.parentNode);
                var line = glink.select('line');
                var current = line.attr('stroke-width').replace('px', '');
                line.attr('stroke-width', current/2);
                var text = glink.select('text');
                var current = text.style('font-size').replace('px', '');
                text.style('font-size', current/2);
            });

        this.linkLabels = this.glinks.append('text')
            .text(function(d) {
                return d.events.length;
            })
            .style('opacity', 0.5)
            .style('font-size', _this.vars.font_size)
            .attr('class', 'linklabel');

        this.gnodes = this.holder.append('g')
            .attr('class', 'nodes')
            .selectAll()
            .data(graph.nodes)
            .enter()
            .append('g')
            .attr('id', function(d) {
                return 'gnode_' + d.id;
            })
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        function dragstarted(d) {
            if(!d3.event.active) {
                _this.simulation.alphaTarget(0.1).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(d) {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        }

        function dragended(d) {
            if(!d3.event.active) _this.simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        this.nodes = this.gnodes.append('rect')
            .attr('width', function(d) {
                return d.width;
            })
            .attr('height', function(d) {
                return d.height;
            })
            .style('opacity', 0.5)
            .style('fill', node_color)
            .on('click', function(d) {
                if(_this.vars.highlighted) {
                    _this.reset_opacity();
                } else {
                    // nodes that are reachable with only "has" or "is" edges
                    var set = _this.has_is_dfs(d);
                    // highlight links/endges that goes to/out of nodes from set
                    _this.glinks.style('opacity', 0.1);
                    graph.links.forEach(function(d) {
                        var glink = d3.select('#glink_' + d.index);
                        if(set.has(d.source.id) || set.has(d.target.id)) {
                            glink.style('opacity', 1);
                        }
                    });
                    // highlight nodes from set
                    _this.gnodes.style('opacity', 0.1);
                    _this.select_by_id(_this.nodes, set).each(function(d) {
                        d3.select(this.parentNode).style('opacity', 1);
                    });
                    // highlight nodes, that can reach node from set with only
                    // one "access" edge
                    var sshset = _this.access_dfs(set);
                    _this.select_by_id(_this.nodes, sshset).each(function(d) {
                        d3.select(this)
                            .style('stroke', 'black')
                            .style('stroke-width', 1)
                        d3.select(this.parentNode)
                            .style('opacity', 1);
                    });
                }
                _this.vars.highlighted = !_this.vars.highlighted;
            })
            .on('mouseover', function(d) {
                /* Show node's full text.*/
                d3.select(this.parentNode).select('text')
                    .attr('old_text', function(d) {
                        return this.textContent;
                    })
                    .text(d.value);
            })
            .on('mouseout', function(d) {
                /* Reset node's text to initial value. */
                d3.select(this.parentNode).select('text')
                    .text(function(d) {
                        return d3.select(this).attr('old_text');
                    });
            })

        ;
        this.nodeLabels = this.gnodes.append('text')
            .style('font-size', _this.vars.font_size)
            .style('font-family', 'monospace')
            .style('pointer-events', 'none')
            .text(function(d) {
                /* Makes sure the node's text is not too long. */
                var text = d.value;
                if(text.length <= _this.vars.text_length) {
                    return text;
                } else {
                    return text.slice(0, _this.vars.text_length - 3) + '...';
                }
            })
            .style('fill', 'black');
    }

    Map.prototype.filter_events = function(from_time, to_time) {
        /* Remove edges that did not happen between  from_time and to_time.
         * Note that other methods have to be called for this to have actual
         * effect.
         */
        var new_links = new Array();
        var _this = this;
        this.graph.links.forEach(function(d) {
            var new_events = new Array();
            d.events.forEach(function(e) {
                if(e.timestamp >= from_time && e.timestamp <= to_time) {
                    new_events.push(e);
                }
            });
            if(new_events.length > 0) {
                d.events = new_events;
                new_links.push(d);
            }
        });
        this.graph.links = new_links;
    }

    Map.prototype.set_filter = function(from_time, to_time) {
        /* Sets filter and triggers and ensures proper drawing of the graph. */
        var _this = this;
        _this.filter_events(from_time, to_time);
        // this must be done because some links maybe filtered out.
        _this.set_forces();
        _this.set_elements();
        // this will restore zoom level as before.
        _this.zoomed();
        _this.simulation.alphaTarget(0.01).restart();
    }

    Map.prototype.render = function(data, element) {
        /* Renders actual graph based on data in element. */
        this.vars = { // variables that needs to be accessed in other methods
            font_size: 15,
            text_length: 20,
            margin: {
                top: 50,
                right: 75,
                bottom: 0,
                left: 40
            },
            highlighted: false
        };
        var _this = this;
        this.height = 1100;
        this.width = 1200;
        this.simulation;
        this.element = element;

        this.set_data(data);
        this.set_forces();

        graph = this.graph;
        var min_timestamp = 2439118792937500;
        var max_timestamp = 0;

        graph.links.forEach(function(link) {
            link.events.forEach(function(e) {
                min_timestamp = Math.min(min_timestamp, e.timestamp);
                max_timestamp = Math.max(max_timestamp, e.timestamp);
            })
        })

        graph.nodes.forEach(function(d) {
            d.height = 20;
            d.width = Math.min(_this.vars.text_length, d.value.length) * 10 + 2;
        });

        this.timeline_holder = d3.select(element).append('p');

        this.timeline_holder.append('input').attr('type', 'number')
            .attr('id', 'from_time')
            .attr('step', 60)
            .attr('value', min_timestamp);

        this.timeline_holder.append('input').attr('type', 'number')
            .attr('id', 'to_time')
            .attr('step', 60)
            .attr('value', max_timestamp);

        this.timeline_holder.append('button')
            .attr('type', 'button')
            .attr('id', 'filter_button')
            .text('Filter');

        this.timeline_holder.select('#filter_button')
            .on('click', function() {
                var from_time = d3.select('#from_time').property('value');
                var to_time = d3.select('#to_time').property('value');
                _this.set_filter(from_time, to_time);
            });

        d3.select(element).select('svg').remove();
        this.svg = d3.select(element).append('svg')
            .attr('width', _this.width)
            .attr('height', _this.height);


        this.holder = this.svg.append('g');

        this.svg.append('svg:defs').append('svg:marker')
            .attr('id', 'mid-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', -10)
            .attr('markerWidth', 3)
            .attr('markerHeight', 3)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#000');

        this.old_scale = 1;
        this.svg.call(d3.zoom()
            .scaleExtent([1 / 5, 20])
            .on('zoom', function() {
                if(typeof _this.transform != 'undefined'){
                    _this.old_scale = _this.transform.k;
                }
                _this.transform = d3.event.transform;
                _this.zoomed()
            }));

        this.set_elements();

        this.simulation.restart();

        // adjacency list representation of graph
        this.G = new Array(graph.nodes.length);
        for(var i = 0; i < graph.nodes.length; i++) {
            this.G[i] = new Array();
        }
        for(var i = 0; i < graph.links.length; i++) {
            var link = graph.links[i];
            this.G[link.source.id].push(link);
            this.G[link.target.id].push(link);
        }
    };
    Map.prototype.select_by_id = function(selection, id_set) {
        /* Helper function to select multiple elements by their data ids.*/
        return selection.filter(function(d) {
            return id_set.has(d.id);
        });
    }

    Map.prototype.reset_opacity = function() {
        /* Set opacity of elements to their initial value. */
        this.nodes.style('stroke-width', 0)
        this.glinks.style('opacity', 1);
        this.gnodes.style('opacity', 1);
    }

    Map.prototype.zoomed = function() {
        /* Handles zoom event*/
        var _this = this;
        if(typeof _this.transform == 'undefined') {
            return;
        }
        _this.holder.attr('transform', _this.transform);
        var new_font_size = _this.vars.font_size / _this.transform.k;
        _this.nodeLabels.style('font-size', new_font_size);
        _this.linkLabels.style('font-size', function(){
            var text = d3.select(this);
            var font_size = text.style('font-size').replace('px','');
            return font_size * _this.old_scale / _this.transform.k ;
        });
        _this.nodes.attr('width', function(d) {
                return d.width / _this.transform.k
            })
            .attr('height', function(d) {
                return d.height / _this.transform.k
            })
            .attr('zoom', _this.transform.k);
        _this.links.attr('stroke-width', function(){
            var text = d3.select(this);
            var font_size = text.attr('stroke-width').replace('px','');
            return font_size * _this.old_scale / _this.transform.k ;
        });
        this.tick(); //because transform is broken with text
    }

    Map.prototype.has_is_dfs = function(d) {
        /* Finds all nodes that are reachable from d only through 'has' and
         * 'is' links/edges. *
         * d can be array of nodes or one node.
         */
        var _this = this;
        var done = new Set();
        var link_types = ['has', 'is']
        var dfs = function(node) {
            if(done.has(node)) return;
            done.add(node);
            for(var i = 0; i < _this.G[node].length; i++) {
                var link = _this.G[node][i];
                if(link_types.indexOf(link.type) !== -1) {
                    dfs(link.source.id);
                    dfs(link.target.id);
                }
            }
        }
        if(d instanceof Array) {
            for(var i = 0; i < d.length; i++) {
                dfs(d[i].id);
            }
        } else {
            dfs(d.id);
        }
        return done;
    }

    Map.prototype.access_dfs = function(d) {
        var done = new Set();
        var _d = d;
        d = Array.from(d);
        for(var i = 0; i < d.length; i++) {
            for(var j = 0; j < this.G[d[i]].length; j++) {
                var link = this.G[d[i]][j];

                if(link.type == 'access') {
                    done.add(link.source.id);
                    done.add(link.target.id);
                }
            }
        }
        for(var i = 0; i < d.length; i++) {
            done.delete(d[i]);
        }
        return done;
    }

    Map.prototype.tick = function() {
        /* Handles one tick of simulation. */

        // using quadtree for fast collision detection.
        var q = d3.quadtree()
            .x(function(d) {
                return d.x;
            })
            .y(function(d) {
                return d.y;
            })
            .addAll(this.graph.nodes);

        for(var i = 0; i < this.graph.nodes.length; i++) {
            // visit every node and check for collisions
            q.visit(collide(this.graph.nodes[i]));
        }

        // moving links
        this.links
            .attr('x1', function(d) {
                return d.source.x;
            })
            .attr('y1', function(d) {
                return d.source.y;
            })
            .attr('x2', function(d) {
                return d.target.x;
            })
            .attr('y2', function(d) {
                return d.target.y;
            });
        // moving nodes
        this.nodes
            .attr('x', function(d) {
                return d.x;
            })
            .attr('y', function(d) {
                return d.y;
            });
        // moving node labels
        this.nodeLabels
            .attr('x', function(d) {
                var rect = d3.select(this.parentNode).select('rect');
                var rectWidth = rect.attr('width');
                return d.x + rectWidth * 0.03;
            })
            .attr('y', function(d) {
                var rect = d3.select(this.parentNode).select('rect');
                var rectHeight = rect.attr('height');
                return d.y + rectHeight * 0.85;
            });
        // moving link labels
        this.linkLabels
            .attr('x', function(d) {
                return(d.source.x + d.target.x) / 2;
            })
            .attr('y', function(d) {
                return(d.source.y + d.target.y) / 2;
            });

    }


    function collide(node) {
        /* Returns visitor that detects and resolves collisions with node.*/
        return function(tree, x1, y1, x2, y2) {
            /* Gets subguadtree and current bounding box.
             * Determines if this bounding box needs to be considered.
             * In case the tree contains only one node, resolves collision with
             * this node.
             */
            var xPadding = node.width*0.02,
                yPadding = node.width*0.02;
            // expand the bounding box
            x2 += node.width + xPadding;
            y2 += node.height + yPadding;
            var nx1 = node.x - xPadding,
                ny1 = node.y - yPadding,
                nx2 = node.x + node.width + xPadding,
                ny2 = node.y + node.height + yPadding,
                left = Math.min(x1, nx1, x2, nx2),
                right = Math.max(x1, nx1, x2, nx2),
                up = Math.min(y1, ny1, y2, ny2),
                down = Math.max(y1, ny1, y2, ny2),
                xSize = (x2 - x1) + (nx2 - nx1),
                ySize = (y2 - y1) + (ny2 - ny1);

            var xOverlap = xSize - (right - left),
                yOverlap = ySize - (down - up);

            // check is node overlaps with the bounding box
            if(xOverlap > 0 && yOverlap > 0) {
                if('data' in tree && (tree.data !== node)) {
                    var point = tree.data;
                    var dx = node.x - point.x,
                        dy = node.y - point.y,
                        xSpacing = (point.width + node.width) / 2,
                        ySpacing = (point.height + node.height) / 2,
                        absX = Math.abs(dx),
                        absY = Math.abs(dy),
                        l,
                        lx,
                        ly;

                    if(absX < xSpacing && absY < ySpacing) {
                        l = Math.sqrt(dx * dx + dy * dy);

                        lx = (absX - xSpacing) / l;
                        ly = (absY - ySpacing) / l;

                        // the one that's barely within the bounds probably triggered the collision
                        if(Math.abs(lx) > Math.abs(ly)) {
                            lx = 0;
                        } else {
                            ly = 0;
                        }
                        dx *= lx;
                        node.x -= dx;
                        dy *= ly;
                        node.y -= dy;
                        point.x += dx;
                        point.y += dy;
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
        /* Creates force that attracts machines on places that are around r
         * away from point (x,y).
         */
        var nodes,
            alpha;
        if(x == null) x = 0;
        if(y == null) y = 0;
        if(r == null) r = 200;

        function force(_) {
            var i, n = nodes.length,
                radius, dx, dy, ratio,
                upr = r * 1.1,
                downr = r * 0.9,
                rr;
            for(alpha = _, i = 0; i < n; ++i) {
                dx = nodes[i].x - x;
                dy = nodes[i].y - y;
                radius = Math.sqrt(dx * dx + dy * dy)
                if(radius < 1) {
                    radius = 1;
                }
                if(nodes[i].type == 'machine_name'
                    || nodes[i].type == 'machine_ip') {
                    if(radius < downr) {
                        rr = downr;
                    } else if(upr < radius) {
                        rr = upr;
                    } else {
                        continue;
                    }
                    ratio = (rr - radius) / rr;
                    nodes[i].vx += ratio * dx/2;
                    nodes[i].vy += ratio * dy/2;
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
            'machine_name': d3.schemeCategory20[1],
            'ip': d3.schemeCategory20[3],
            'user_name': d3.schemeCategory20[5],
            'user_id': d3.schemeCategory20[7]
        }
        if(node.type in maper) {
            return maper[node.type];
        } else {
            return d3.color('orange');
        }
    }

    function link_strength(link) {
        var maper = {
            'has': 1,
            'is': 1,
            'access': 0.1,
        }
        return maper[link.type];
        if(link.type in maper) {
            return maper[link.type];
        } else {
            return 1;
        }
    }

    function link_color(link) {
        var maper = {
            'is': d3.color('red'),
            'has': d3.color('blue'),
            'access': d3.color('green'),
        }
        if(link.type in maper) {
            return maper[link.type];
        } else {
            return d3.color('orange');
        }
    }

    var exports = {}
    exports.Map = Map;
    return exports;
}());