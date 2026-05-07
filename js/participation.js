class ParticipationView {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.margin = { top: 20, right: 24, bottom: 40, left: 56 };
        this.setupSVG();
    }

    setupSVG() {
        this.container.html("");
        this.width = parseInt(this.container.style("width")) - this.margin.left - this.margin.right;
        this.height = parseInt(this.container.style("height")) - this.margin.top - this.margin.bottom;

        this.svg = this.container.append("svg")
            .attr("viewBox", `0 0 ${this.width + this.margin.left + this.margin.right} ${this.height + this.margin.top + this.margin.bottom}`)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleBand().padding(0.25).range([0, this.width]);
        this.yScale = d3.scaleLinear().domain([0, 100]).range([this.height, 0]);
        this.genderScale = d3.scaleLinear().domain([0, 100]).range([0, this.width]);

        this.xAxis = this.svg.append("g").attr("transform", `translate(0,${this.height})`);
        this.yAxis = this.svg.append("g");
        this.chartGroup = this.svg.append("g");
        this.genderGroup = this.svg.append("g").attr("transform", `translate(0,${Math.max(110, this.height - 78)})`);
    }

    render(year, selectedState) {
        const allParticipation = state.participationData || [];
        const allGender = state.candidateGenderData || [];

        let turnoutRows = allParticipation.filter(d => d.YEAR === parseInt(year));
        let genderRows = allGender.filter(d => d.YEAR === parseInt(year));

        if (selectedState) {
            turnoutRows = turnoutRows.filter(d => d.State === selectedState);
            genderRows = genderRows.filter(d => d.State === selectedState);
        }

        this.svg.selectAll(".no-data-msg").remove();

        if (turnoutRows.length === 0 && genderRows.length === 0) {
            this.chartGroup.selectAll("*").remove();
            this.genderGroup.selectAll("*").remove();
            this.xAxis.selectAll("*").remove();
            this.yAxis.selectAll("*").remove();
            this.svg.append("text")
                .attr("class", "no-data-msg")
                .attr("x", this.width / 2)
                .attr("y", this.height / 2)
                .attr("text-anchor", "middle")
                .style("fill", "#888")
                .text("Turnout and candidate gender data are not available for this selection.");
            return;
        }

        this.renderTurnout(year, turnoutRows);
        this.renderGender(year, genderRows);
    }

    renderTurnout(year, rows) {
        const byState = Array.from(
            d3.rollup(
                rows,
                values => d3.mean(values, d => +d.Total_Turnout),
                d => d.State
            ),
            ([State, Turnout]) => ({ State, Turnout })
        )
            .filter(d => Number.isFinite(d.Turnout))
            .sort((a, b) => d3.descending(a.Turnout, b.Turnout))
            .slice(0, state.selectedState ? 12 : 10);

        this.xScale.domain(byState.map(d => d.State));
        this.yScale.domain([0, Math.max(80, d3.max(byState, d => d.Turnout) || 80)]).nice();

        this.xAxis.call(d3.axisBottom(this.xScale).tickFormat(d => d.length > 10 ? `${d.slice(0, 9)}...` : d));
        this.yAxis.call(d3.axisLeft(this.yScale).ticks(5).tickFormat(d => `${d}%`));

        const bars = this.chartGroup.selectAll(".turnout-bar").data(byState, d => d.State);

        bars.enter()
            .append("rect")
            .attr("class", "turnout-bar")
            .attr("x", d => this.xScale(d.State))
            .attr("y", this.yScale(0))
            .attr("width", this.xScale.bandwidth())
            .attr("height", 0)
            .on("mouseover", (event, d) => {
                showTooltip(`
                    <div class="tooltip-title">${d.State} ${year}</div>
                    <div class="tooltip-row"><span>Avg. turnout:</span> <span class="tooltip-val">${d.Turnout.toFixed(1)}%</span></div>
                `, event);
            })
            .on("mousemove", moveTooltip)
            .on("mouseout", hideTooltip)
            .merge(bars)
            .transition().duration(500)
            .attr("x", d => this.xScale(d.State))
            .attr("y", d => this.yScale(d.Turnout))
            .attr("width", this.xScale.bandwidth())
            .attr("height", d => this.height - this.yScale(d.Turnout));

        bars.exit().remove();

        const note = rows.find(d => d.Coverage_Note)?.Coverage_Note || "";
        const notes = this.chartGroup.selectAll(".coverage-note").data(note ? [note] : []);
        notes.enter()
            .append("text")
            .attr("class", "coverage-note")
            .attr("x", 0)
            .attr("y", 12)
            .merge(notes)
            .text(d => d);
        notes.exit().remove();
    }

    renderGender(year, rows) {
        this.genderGroup.selectAll("*").remove();

        const total = d3.sum(rows, d => d.Candidates);
        if (!total) {
            this.genderGroup.append("text")
                .attr("class", "small-note")
                .attr("x", 0)
                .attr("y", 30)
                .text(`Candidate gender coverage is unavailable for ${year}.`);
            return;
        }

        const genders = Array.from(
            d3.rollup(rows, values => d3.sum(values, d => d.Candidates), d => d.Gender),
            ([Gender, Candidates]) => ({ Gender, Candidates, Share: Candidates / total * 100 })
        ).sort((a, b) => d3.descending(a.Candidates, b.Candidates));

        let x = 0;
        this.genderGroup.append("text")
            .attr("class", "gender-title")
            .attr("x", 0)
            .attr("y", -8)
            .text(`Candidate gender mix (${year})`);

        const color = d3.scaleOrdinal()
            .domain(["MALE", "FEMALE", "OTHER"])
            .range(["#58a6ff", "#f778ba", "#a371f7"]);

        genders.forEach(d => {
            const width = this.genderScale(d.Share);
            this.genderGroup.append("rect")
                .attr("class", "gender-segment")
                .attr("x", x)
                .attr("y", 8)
                .attr("width", width)
                .attr("height", 22)
                .attr("fill", color(d.Gender));
            if (width > 58) {
                this.genderGroup.append("text")
                    .attr("class", "gender-label")
                    .attr("x", x + width / 2)
                    .attr("y", 23)
                    .attr("text-anchor", "middle")
                    .text(`${d.Gender} ${d.Share.toFixed(0)}%`);
            }
            x += width;
        });
    }
}
