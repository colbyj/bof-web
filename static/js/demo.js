(function () {
    const SUMMARIZE_URL_BASE = "https://manage.frankensystem.net/api/questionnaire-demos/";

    const form = document.getElementById("demo-form");
    const submitBtn = document.getElementById("demo-submit");
    const resultsEl = document.getElementById("demo-results");
    if (!form || !submitBtn || !resultsEl) return;

    const slug = form.getAttribute("data-slug");
    if (!slug) return;

    submitBtn.addEventListener("click", async function () {
        const answers = collectAnswers(form);
        submitBtn.disabled = true;
        submitBtn.textContent = "Computing…";
        try {
            const response = await fetch(SUMMARIZE_URL_BASE + encodeURIComponent(slug) + "/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers: answers }),
            });
            if (response.status === 429) {
                renderError("You're sending requests too fast. Try again in a minute.");
                return;
            }
            if (!response.ok) {
                const text = await response.text();
                renderError("Couldn't compute results: HTTP " + response.status + (text ? " — " + text : ""));
                return;
            }
            const data = await response.json();
            renderResults(data);
        } catch (err) {
            renderError("Couldn't reach the BOFS preview service: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Compute results";
        }
    });

    form.addEventListener("reset", function () {
        resultsEl.innerHTML = "";
    });

    // Walk every form input the BOFS preview produced and produce a flat
    // {field_id: value} mapping that mirrors what Flask's request.form would
    // hand BOFS in production. Checkboxes that are unchecked are intentionally
    // omitted (BOFS persists the column default in that case).
    function collectAnswers(formEl) {
        const out = {};
        const formData = new FormData(formEl);
        for (const [key, value] of formData.entries()) {
            // FormData groups same-named fields (radios, multi-checkboxes); for
            // simple BOFS questions a "last wins" behaviour matches the server.
            out[key] = value;
        }
        return out;
    }

    function renderError(message) {
        resultsEl.innerHTML = "";
        const box = document.createElement("div");
        box.className = "callout";
        box.style.borderLeftColor = "var(--text-medium)";
        const p = document.createElement("p");
        p.className = "text-warning";
        p.textContent = message;
        box.appendChild(p);
        resultsEl.appendChild(box);
    }

    function renderResults(data) {
        resultsEl.innerHTML = "";

        const heading = document.createElement("h3");
        heading.textContent = "Results";
        resultsEl.appendChild(heading);

        // Raw values — one row per BOFS column.
        if (Array.isArray(data.raw_values) && data.raw_values.length > 0) {
            resultsEl.appendChild(buildSection("Raw values (what BOFS would store)", data.raw_values, false));
        }

        // Calculated values — error or value per calc.
        if (Array.isArray(data.calculated_values) && data.calculated_values.length > 0) {
            resultsEl.appendChild(buildSection("Calculated values", data.calculated_values, true));
        }

        if (
            (!Array.isArray(data.raw_values) || data.raw_values.length === 0)
            && (!Array.isArray(data.calculated_values) || data.calculated_values.length === 0)
        ) {
            const p = document.createElement("p");
            p.className = "text-muted";
            p.textContent = "No fields to display.";
            resultsEl.appendChild(p);
        }
    }

    function buildSection(title, rows, includeErrorColumn) {
        const wrap = document.createElement("div");
        wrap.style.marginTop = "1rem";

        const h = document.createElement("h4");
        h.textContent = title;
        wrap.appendChild(h);

        const table = document.createElement("table");
        table.className = "demo-results-table";

        const thead = document.createElement("thead");
        const trh = document.createElement("tr");
        ["Field", "Value"].forEach(function (label) {
            const th = document.createElement("th");
            th.textContent = label;
            trh.appendChild(th);
        });
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        rows.forEach(function (row) {
            const tr = document.createElement("tr");
            const tdField = document.createElement("td");
            tdField.textContent = row.prompt || row.id || "";
            tr.appendChild(tdField);

            const tdValue = document.createElement("td");
            if (includeErrorColumn && row.error) {
                tdValue.innerHTML = "";
                const em = document.createElement("em");
                em.className = "text-warning";
                em.textContent = "error: " + row.error;
                tdValue.appendChild(em);
            } else {
                tdValue.textContent = formatValue(row.value);
            }
            tr.appendChild(tdValue);

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);

        return wrap;
    }

    function formatValue(v) {
        if (v === null || v === undefined || v === "") return "—";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
    }
})();
