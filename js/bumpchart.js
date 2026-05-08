class BumpChartView {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = d3.select(containerId);
        
        // Setup SVG canvas and margins
        this.margin = {top: 30, right: 120, bottom: 40, left: 50};
        this.setupSVG();

        // Data 
        this.fullData = state.partyRanks; 
        
        this.drawBase();
    }

    setupSVG() {
        this.container.html(""); // clear
        const size = getChartSize(this.container, this.margin, 640, 300);
        this.width = size.width;
        this.height = size.height;
        
        this.svg = this.container.append('svg')
            .attr("viewBox", `0 0 ${this.width + this.margin.left + this.margin.right} ${this.height + this.margin.top + this.margin.bottom}`)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
    }

    drawBase() {
        this.xScale = d3.scalePoint()
            .domain(state.years)
            .range([0, this.width])
            .padding(0.1);

        // Maximum ranks to show (Top 10)
        this.yScale = d3.scaleLinear()
            .domain([1, 10])
            .range([0, this.height]);

        // Axes
        this.svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale).tickFormat(d3.format("d")).tickSizeOuter(0));
            
        this.svg.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(this.yScale).ticks(10).tickFormat(d => `#${d}`));
            
        // Gridlines
        this.svg.selectAll("line.grid")
            .data(state.years)
            .enter().append("line")
            .attr("class", "grid")
            .attr("x1", d => this.xScale(d))
            .attr("x2", d => this.xScale(d))
            .attr("y1", 0)
            .attr("y2", this.height)
            .style("stroke", "rgba(255,255,255,0.05)")
            .style("stroke-dasharray", "4,4");
            
        this.lineGenerator = d3.line()
            .x(d => this.xScale(d.YEAR))
            .y(d => this.yScale(d.Rank))
            .curve(d3.curveMonotoneX);
            
        this.linesGroup = this.svg.append("g").attr("class", "lines-group");
        this.nodesGroup = this.svg.append("g").attr("class", "nodes-group");
        this.labelsGroup = this.svg.append("g").attr("class", "labels-group");
    }

    render(selectedState) {
        // Since bump chart data is pre-aggregated nationally in party_ranks.csv,
        // IF a state is selected, we need to re-aggregate on the fly from winnersData.
        let displayData = this.fullData;
        
        if (selectedState) {
            // Aggregate Top 10 for this state
            let stateTots = {};
            // Group by Year and Party
            state.winnersData.filter(d => d.State && d.State.toUpperCase() === selectedState).forEach(d => {
                const key = `${d.YEAR}_${d.Party}`;
                stateTots[key] = (stateTots[key] || 0) + 1;
            });
            
            // Reconstruct partyRanks structure
            let reconstructed = [];
            state.years.forEach(yr => {
                let yrParties = [];
                for(let k in stateTots) {
                    if(k.startsWith(yr.toString())) {
                        yrParties.push({Party: k.split('_')[1], Seats: stateTots[k]});
                    }
                }
                // Sort to get rank
                yrParties.sort((a,b) => b.Seats - a.Seats);
                yrParties.forEach((p, idx) => {
                    if (idx < 10) { // Only top 10
                        reconstructed.push({
                            YEAR: yr,
                            Party_Standard: p.Party,
                            Seats: p.Seats,
                            Rank: idx + 1
                        });
                    }
                });
            });
            displayData = reconstructed;
        }

        // Group by Party
        const nested = d3.group(displayData, d => d.Party_Standard);
        const partyArray = Array.from(nested, ([key, values]) => ({ key, values }));

        // Bind Lines
        const lines = this.linesGroup.selectAll(".bump-line").data(partyArray, d => d.key);
        
        lines.enter().append("path")
            .attr("class", "bump-line")
            .attr("fill", "none")
            .style("stroke", d => getPartyColor(d.key))
            .style("stroke-width", 3)
            .attr("d", d => this.lineGenerator(d.values))
            .style("opacity", 0)
            .merge(lines)
            .transition().duration(750)
            .attr("d", d => this.lineGenerator(d.values))
            .style("opacity", d => {
                if (state.selectedParty && state.selectedParty !== d.key) return 0.1;
                return 0.8;
            });
            
        lines.exit().transition().duration(300).style("opacity", 0).remove();

        // Bind Nodes
        const nodesData = [];
        displayData.forEach(d => {
            if (d.Rank <= 10) nodesData.push(d); // sanity check
        });

        const nodes = this.nodesGroup.selectAll(".bump-node").data(nodesData, d => `${d.Party_Standard}-${d.YEAR}`);
        
        nodes.enter().append("circle")
            .attr("class", "bump-node")
            .attr("r", 5)
            .attr("cx", d => this.xScale(d.YEAR))
            .attr("cy", d => this.yScale(d.Rank))
            .style("fill", d => getPartyColor(d.Party_Standard))
            .on("mouseover", (event, d) => {
                showTooltip(`
                    <div class="tooltip-title" style="color:${getPartyColor(d.Party_Standard)}">${d.Party_Standard}</div>
                    <div class="tooltip-row"><span>Year:</span> <span class="tooltip-val">${d.YEAR}</span></div>
                    <div class="tooltip-row"><span>Rank:</span> <span class="tooltip-val">#${d.Rank}</span></div>
                    <div class="tooltip-row"><span>Seats Won:</span> <span class="tooltip-val">${d.Seats}</span></div>
                `, event);
            })
            .on("mousemove", moveTooltip)
            .on("mouseout", hideTooltip)
            .on("click", (event, d) => {
                if (state.selectedParty === d.Party_Standard) {
                    setFilter('party', null);
                } else {
                    setFilter('party', d.Party_Standard);
                }
            })
            .style("opacity", 0)
            .merge(nodes)
            .transition().duration(750)
            .attr("cx", d => this.xScale(d.YEAR))
            .attr("cy", d => this.yScale(d.Rank))
            .style("opacity", d => {
                if (state.selectedParty && state.selectedParty !== d.Party_Standard) return 0.1;
                return 1;
            });
            
        nodes.exit().remove();

        // End Labels (right side of the 2024 nodes)
        const recentData = displayData.filter(d => d.YEAR === 2024);
        const labels = this.labelsGroup.selectAll(".bump-label").data(recentData, d => d.Party_Standard);

        labels.enter().append("text")
            .attr("class", "bump-label")
            .attr("x", this.xScale(2024) + 10)
            .attr("y", d => this.yScale(d.Rank))
            .text(d => `${d.Party_Standard} (${d.Seats})`)
            .style("opacity", 0)
            .merge(labels)
            .transition().duration(750)
            .attr("y", d => this.yScale(d.Rank))
            .text(d => `${d.Party_Standard} (${d.Seats})`)
            .style("opacity", d => {
                if (state.selectedParty && state.selectedParty !== d.Party_Standard) return 0.1;
                return 1;
            });
            
        labels.exit().remove();
    }
}
