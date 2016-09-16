var LateralMap = (function() {

    var Map = function() {};
    Map.prototype.set_data = function(data) {
        // Permanent copy of data.
        this.backup_data = JSON.parse(JSON.stringify(data));
        // Working data.
        this.graph = JSON.parse(JSON.stringify(data));
    }

    Map.prototype.reset = function() {
        this.graph = JSON.parse(JSON.stringify(this.backup_data));
    }

    Map.prototype.set_forces = function() {
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
            .force('circular', circular(this.width / 2, this.height / 2, 400)).stop();
    }

    Map.prototype.set_elements = function() {
        var _this = this;
        this.holder.selectAll('*').remove();
        this.glinks = this.holder.append('g')
            .attr('class', 'links')
            .selectAll('line')
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
                text.style('font-size', current/2);            })
            ;



        this.edgelabels = this.glinks.append('text')
            .text(function(d) {
                return d.events.length;
            })
            .style('opacity', 0.5)
            .style('font-size', _this.vars.font_size)
            .attr('class', 'edgelabel');

        this.gnodes = this.holder.append('g')
            .attr('class', 'nodes')
            .selectAll('.node')
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
            if(!d3.event.active) _this.simulation.alphaTarget(0.01).restart();
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
                    var set = _this.has_is_dfs(d);

                    _this.glinks.style('opacity', 0.1);
                    graph.links.forEach(function(d) {
                        var glink = d3.select('#glink_' + d.index);
                        if(set.has(d.source.id) || set.has(d.target.id)) {
                            glink.style('opacity', 1);
                        }
                    });

                    _this.gnodes.style('opacity', 0.1);
                    _this.select_by_id(_this.nodes, set).each(function(d) {
                        d3.select(this.parentNode).style('opacity', 1);
                    });

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
                d3.select(this.parentNode).select('text')
                    .attr('old_text', function(d) {
                        return this.textContent;
                    })
                    .text(d.value);
            })
            .on('mouseout', function(d) {
                d3.select(this.parentNode).select('text')
                    .text(function(d) {
                        return d3.select(this).attr('old_text');
                    });
            })

        ;
        this.nodelabels = this.gnodes.append('text')
            .style('font-size', _this.vars.font_size)
            .style('font-family', 'monospace')
            .style('pointer-events', 'none')
            .text(function(d) {
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
        var _this = this;
        _this.filter_events(from_time, to_time);
        _this.set_forces();
        _this.set_elements();
        _this.zoomed();
        _this.simulation.alphaTarget(0.01).restart();
    }


    Map.prototype.render = function(data, element) {
        this.vars = {
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

        this.timeline_holder.append('button').attr('type', 'button').attr('id', 'filter_button').text('Filter');
        this.timeline_holder.select('#filter_button').on('click', function() {
            _this.set_filter(d3.select('#from_time').property('value'), d3.select('#to_time').property('value'))
        })



        d3.select(element).select('svg').remove();
        this.svg = d3.select(element).append('svg').attr('width', _this.width)
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
        return selection.filter(function(d) {
            return id_set.has(d.id);
        });
    }

    Map.prototype.reset_opacity = function() {
        this.nodes.style('stroke-width', 0)
        this.glinks.style('opacity', 1);
        this.gnodes.style('opacity', 1);
    }

    Map.prototype.zoomed = function() {
        var _this = this;
        if(typeof _this.transform == 'undefined') return;
        _this.holder.attr('transform', _this.transform);
        _this.nodelabels.style('font-size', _this.vars.font_size / _this.transform.k);
        _this.edgelabels.style('font-size', function(){
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
        var _this = this;
        var done = new Set();
        var edge_types = ['has', 'is']
        var dfs = function(node) {
            if(done.has(node)) return;
            done.add(node);
            for(var i = 0; i < _this.G[node].length; i++) {
                var link = _this.G[node][i];
                if(edge_types.indexOf(link.type) !== -1) {
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
        var i = 0,
            n = this.graph.nodes.length;
        var q = d3.quadtree()
            .x(function(d) {
                return d.x;
            })
            .y(function(d) {
                return d.y;
            })
            .addAll(this.graph.nodes);
        while(++i < n) {
            q.visit(collide(this.graph.nodes[i]));
        }

        //moving
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
        this.nodes
            .attr('x', function(d) {
                return d.x;
            })
            .attr('y', function(d) {
                return d.y;
            });
        this.nodelabels
            .attr('x', function(d) {
                var rect_width = d3.select(this.parentNode).select('rect').attr('width');

                return d.x + rect_width * 0.03;
            })
            .attr('y', function(d) {
                var rect_height = d3.select(this.parentNode).select('rect').attr('height');
                return d.y + rect_height * 0.85;
            });
        this.edgelabels
            .attr('x', function(d) {
                return(d.source.x + d.target.x) / 2;
            })
            .attr('y', function(d) {
                return(d.source.y + d.target.y) / 2;
            });

    }


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

            if(right - left < xSize && down - up < ySize) {
                if('data' in tree && (tree.data !== node)) {
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

                    if(absX < xSpacing && absY < ySpacing) {
                        l = Math.sqrt(x * x + y * y);

                        lx = (absX - xSpacing) / l;
                        ly = (absY - ySpacing) / l;

                        // the one that's barely within the bounds probably triggered the collision
                        if(Math.abs(lx) > Math.abs(ly)) {
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
        if(x == null) x = 0;
        if(y == null) y = 0;
        if(r == null) r = 200;

        function force(_) {
            var i, n = nodes.length,
                radius, dx, dy, ratio, upr = r * 1.1,
                downr = r * 0.9,
                rr;
            for(alpha = _, i = 0; i < n; ++i) {

                dx = nodes[i].x - x;
                dy = nodes[i].y - y;
                radius = Math.sqrt(dx * dx + dy * dy)
                if(radius < 1) radius = 1;

                if(nodes[i].type == 'machine_name' || nodes[i].type == 'machine_ip') {
                    if(radius < downr) {
                        rr = downr;
                    } else if(upr < radius) {
                        rr = upr;
                    } else continue;

                    ratio = (rr - radius) / rr;
                    if(0 < ratio && ratio < 0.5) ratio = ratio * ratio;
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