class ScatterPlotView {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = d3.select(containerId);
        
        this.margin = {top: 20, right: 30, bottom: 40, left: 60};
        this.setupSVG();
        
        this.fullData = state.candidatesData;
        this.drawBase();
    }

    setupSVG() {
        this.container.html("");
        this.width = parseInt(this.container.style('width')) - this.margin.left - this.margin.right;
        this.height = parseInt(this.container.style('height')) - this.margin.top - this.margin.bottom;
        
        this.svg = this.container.append('svg')
            .attr("viewBox", `0 0 ${this.width + this.margin.left + this.margin.right} ${this.height + this.margin.top + this.margin.bottom}`)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
            
        // Zoom area
        this.svg.append("rect")
            .attr("width", this.width)
            .attr("height", this.height)
            .style("fill", "none")
            .style("pointer-events", "all");
    }

    drawBase() {
        // We use a pseudo-log scale for Assets because of massive wealth disparity
        // x => log10(x + 1) to handle zeroes
        this.xScale = d3.scaleSymlog()
            .constant(10000) // Handles 0 well
            .range([0, this.width]);
            
        this.yScale = d3.scaleLinear()
            .range([this.height, 0]);

        this.rScale = d3.scaleSqrt()
            .domain([0, 50]) // Criminal cases usually 0-50
            .range([2, 12])
            .clamp(true);

        this.xAxis = this.svg.append("g")
            .attr("transform", `translate(0,${this.height})`);
            
        this.yAxis = this.svg.append("g");
        
        // Axis Labels
        this.svg.append("text")
            .attr("class", "axis-label")
            .attr("text-anchor", "middle")
            .attr("x", this.width / 2)
            .attr("y", this.height + 35)
            .text("Declared Total Assets (₹)");

        this.svg.append("text")
            .attr("class", "axis-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", -45)
            .attr("x", -this.height / 2)
            .text("Votes Received");
            
        this.dotsGroup = this.svg.append("g");
    }

    render(year, selectedState, selectedParty) {
        const t = d3.transition().duration(750);
        
        // Filter Data
        let data = this.fullData.filter(d => d.YEAR === parseInt(year));
        
        // Remove missing assets so they don't squish at the 0 axis
        data = data.filter(d => !isNaN(parseFloat(d.Total_Assets)) && parseFloat(d.Total_Assets) > 0);
        
        // State Filter
        if (selectedState) {
            data = data.filter(d => d.State && d.State.toUpperCase() === selectedState);
        }

        // If no data (e.g. 2024 or state has no matches), fallback message
        if (data.length === 0) {
            this.dotsGroup.selectAll("*").remove();
            this.svg.selectAll(".no-data-msg").remove();
            this.svg.append("text")
                .attr("class", "no-data-msg")
                .attr("x", this.width/2).attr("y", this.height/2)
                .attr("text-anchor", "middle").style("fill", "#888")
                .text("Affidavit data is unavailable for this selection. Try 2019 for the richest candidate coverage.");
            return;
        } else {
            this.svg.selectAll(".no-data-msg").remove();
        }

        // Update Domains
        const maxVotes = d3.max(data, d => parseFloat(d.Votes)) || 1000000;
        const maxAssets = d3.max(data, d => parseFloat(d.Total_Assets)) || 10000000;
        
        this.xScale.domain([0, maxAssets]);
        this.yScale.domain([0, maxVotes]);

        // Draw Axes with transition
        this.xAxis.transition(t).call(
            d3.axisBottom(this.xScale)
              .tickValues([0, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10])
              .tickFormat(d => {
                  if(d === 0) return "0";
                  if(d === 1e5) return "1L";
                  if(d === 1e6) return "10L";
                  if(d === 1e7) return "1Cr";
                  if(d === 1e8) return "10Cr";
                  if(d === 1e9) return "100Cr";
                  if(d === 1e10) return "1000Cr";
                  return d;
              })
        );
        this.yAxis.transition(t).call(
            d3.axisLeft(this.yScale)
              .ticks(6)
              .tickFormat(d3.format(".1s"))
        );

        // Bind Dots
        const dots = this.dotsGroup.selectAll(".candidate-dot").data(data, d => `${d.Constituency}-${d.Candidate}`);

        // Enter
        dots.enter()
            .append("circle")
            .attr("class", d => `candidate-dot ${d.Is_Winner === 1 ? 'winner' : 'loser'}`)
            .attr("cx", d => this.xScale(parseFloat(d.Total_Assets) || 0))
            .attr("cy", this.height) // Initial animation position
            .attr("r", 0)
            .on("mouseover", function(event, d) {
                d3.select(this).style("stroke", "#fff").style("opacity", 1).style("stroke-width", "2px");
                showTooltip(`
                    <div class="tooltip-title">${d.Candidate} ${d.Is_Winner ? '(Winner)' : ''}</div>
                    <div class="tooltip-row"><span>Party:</span> <span class="tooltip-val" style="color:${getPartyColor(d.Party)}">${d.Party}</span></div>
                    <div class="tooltip-row"><span>Constituency:</span> <span class="tooltip-val">${d.Constituency}</span></div>
                    <div class="tooltip-row"><span>Votes:</span> <span class="tooltip-val">${d.Votes.toLocaleString()}</span></div>
                    <div class="tooltip-row"><span>Assets:</span> <span class="tooltip-val">₹${(parseFloat(d.Total_Assets) || 0).toLocaleString()}</span></div>
                    <div class="tooltip-row"><span>Criminal Cases:</span> <span class="tooltip-val" style="${d.Criminal_Cases>0?'color:#ff4444':''}">${d.Criminal_Cases || 0}</span></div>
                `, event);
            })
            .on("mousemove", moveTooltip)
            .on("mouseout", function() {
                d3.select(this).style("stroke", "var(--panel-bg)").style("opacity", null).style("stroke-width", "0.5px");
                hideTooltip();
            })
            // Update
            .merge(dots)
            .transition(t)
            .attr("cx", d => this.xScale(parseFloat(d.Total_Assets) || 0))
            .attr("cy", d => this.yScale(parseFloat(d.Votes) || 0))
            .attr("r", d => this.rScale(parseFloat(d.Criminal_Cases) || 0))
            .style("display", d => {
                if(selectedParty && d.Party !== selectedParty && d.Is_Winner) return "inline"; // Keep winners visible but faded? Let's just hide unselected
                return "inline";
            })
            .style("opacity", d => {
                if (selectedParty && d.Party !== selectedParty) return 0.05;
                return d.Is_Winner === 1 ? 0.9 : 0.5;
            });

        // Exit
        dots.exit()
            .transition(t)
            .attr("r", 0)
            .remove();
            
        // Bring winners to front
        this.dotsGroup.selectAll('.winner').raise();
    }
}
