class SankeyView {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = d3.select(containerId);
        
        this.margin = {top: 20, right: 30, bottom: 20, left: 30};
        this.setupSVG();

        // Data 
        this.fullData = state.winnersData || []; 
        this.drawBase();
    }

    setupSVG() {
        this.container.html(""); // clear
        this.width = parseInt(this.container.style('width')) - this.margin.left - this.margin.right;
        this.height = parseInt(this.container.style('height')) - this.margin.top - this.margin.bottom;
        
        this.svg = this.container.append('svg')
            .attr("viewBox", `0 0 ${this.width + this.margin.left + this.margin.right} ${this.height + this.margin.top + this.margin.bottom}`)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
            
        this.sankey = d3.sankey()
            .nodeWidth(15)
            .nodePadding(15)
            .extent([[1, 1], [this.width - 1, this.height - 15]]);
    }

    drawBase() {
        // Build dynamically
    }

    render(selectedState) {
        this.svg.selectAll("*").remove(); 
        
        if (typeof d3.sankey !== 'function') {
            this.svg.append("text")
                .attr("x", this.width/2).attr("y", this.height/2)
                .attr("text-anchor", "middle").attr("fill", "#888")
                .text("Sankey library not loaded.");
            return;
        }

        let validElections = [2009, 2014, 2019, 2024];

        // Filter data
        let flowData = state.winnersData.filter(d => validElections.includes(parseInt(d.YEAR)));
        if (selectedState) {
            flowData = flowData.filter(d => d.State && d.State.toUpperCase() === selectedState);
        }

        // Map PC names to their winner per year: pcHistory["State_PC"][2009] = "BJP"
        let pcHistory = {}; 
        flowData.forEach(d => {
            const pcKey = `${d.State}_${d.Constituency}`;
            if(!pcHistory[pcKey]) pcHistory[pcKey] = {};
            
            // Normalize parties
            const isTop = Object.keys(partyColors).includes(d.Party);
            pcHistory[pcKey][parseInt(d.YEAR)] = isTop ? d.Party : 'OTHERS';
        });

        // Generate Nodes and Links
        const years = validElections;
        let nodesMap = new Map();
        let linksMap = new Map();

        for (let i = 0; i < years.length - 1; i++) {
            let y1 = years[i];
            let y2 = years[i+1];
            
            for (let pc in pcHistory) {
                let p1 = pcHistory[pc][y1];
                let p2 = pcHistory[pc][y2];

                // Only trace flow if the constituency existed in BOTH elections (no redistricting loss locally)
                if (p1 && p2) {
                    let sourceId = `${p1}_${y1}`;
                    let targetId = `${p2}_${y2}`;
                    
                    if (!nodesMap.has(sourceId)) nodesMap.set(sourceId, {name: p1, year: y1});
                    if (!nodesMap.has(targetId)) nodesMap.set(targetId, {name: p2, year: y2});
                    
                    let linkId = `${sourceId}->${targetId}`;
                    linksMap.set(linkId, (linksMap.get(linkId) || 0) + 1);
                }
            }
        }

        let nodes = Array.from(nodesMap.entries()).map(([id, data], i) => {
            data.id = id;
            return data;
        });

        // The D3 sankey layout expects node references or indices.
        // It's safer to use the zero-based index of the nodes array.
        let links = Array.from(linksMap.entries()).map(([id, val]) => {
            let [sourceId, targetId] = id.split('->');
            return {
                source: nodes.findIndex(n => n.id === sourceId),
                target: nodes.findIndex(n => n.id === targetId),
                value: val
            };
        });

        if (nodes.length === 0 || links.length === 0) {
            this.svg.append("text").attr("x", this.width/2).attr("y", this.height/2).attr("fill", "#888").attr("text-anchor", "middle").text("Not enough continuous election data.");
            return;
        }

        let graph;
        try {
            graph = this.sankey({
                nodes: nodes.map(d => Object.assign({}, d)),
                links: links.map(d => Object.assign({}, d))
            });
        } catch (error) {
            console.error("Sankey computation failed: ", error);
            this.svg.append("text").attr("x", this.width/2).attr("y", this.height/2).attr("fill", "#888").attr("text-anchor", "middle").text("Sankey graph compute error.");
            return;
        }

        // Draw Links
        this.svg.append("g")
            .attr("fill", "none")
            .selectAll("g")
            .data(graph.links)
            .join("path")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke", d => getPartyColor(d.source.name))
            .attr("stroke-width", d => Math.max(1, d.width))
            .attr("stroke-opacity", 0.3)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("stroke-opacity", 0.7);
                showTooltip(`
                    <div class="tooltip-title">${d.source.name} \u2192 ${d.target.name}</div>
                    <div class="tooltip-row"><span>Seats Retained/Switched:</span> <span class="tooltip-val">${d.value}</span></div>
                    <div class="tooltip-row"><span>Years:</span> <span class="tooltip-val">${d.source.year} \u2192 ${d.target.year}</span></div>
                `, event);
            })
            .on("mousemove", moveTooltip)
            .on("mouseout", function() {
                d3.select(this).attr("stroke-opacity", 0.3);
                hideTooltip();
            });

        // Draw Nodes
        const nodeG = this.svg.append("g")
            .selectAll("g")
            .data(graph.nodes)
            .join("g");
            
        nodeG.append("rect")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => Math.max(1, d.y1 - d.y0))
            .attr("width", d => d.x1 - d.x0)
            .attr("fill", d => getPartyColor(d.name))
            .attr("stroke", "#222")
            .on("mouseover", function(event, d) {
                showTooltip(`
                    <div class="tooltip-title" style="color:${getPartyColor(d.name)}">${d.name} (${d.year})</div>
                    <div class="tooltip-row"><span>Seats:</span> <span class="tooltip-val">${d.value}</span></div>
                `, event);
            })
            .on("mousemove", moveTooltip)
            .on("mouseout", hideTooltip);

        // Labels
        nodeG.append("text")
            .attr("x", d => d.x0 < this.width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < this.width / 2 ? "start" : "end")
            .text(d => (d.y1 - d.y0 > 15) ? d.name : "")
            .style("fill", "#c9d1d9")
            .style("font-size", "10px")
            .style("font-weight", "600");
            
        // Year Headers
        validElections.forEach((y, i) => {
            let xPos = (i / (validElections.length - 1)) * (this.width - 30);
            if (i === validElections.length - 1) xPos = this.width;
            
            this.svg.append("text")
                .attr("x", xPos)
                .attr("y", this.height) // Put it at the bottom instead of top
                .attr("text-anchor", i === 0 ? "start" : (i === validElections.length - 1 ? "end" : "middle"))
                .text(y)
                .style("fill", "#8b949e")
                .style("font-size", "12px");
        });
    }
}
