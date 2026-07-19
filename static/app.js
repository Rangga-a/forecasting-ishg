const API = "";
let chart = null;
let historyYears = 5;

function formatRupiah(value, opts = {}) {
    return "Rp " + Number(value).toLocaleString("id-ID", opts);
}

async function loadMetrics() {
    try {

        const res = await fetch(`${API}/api/metrics`);
        if (!res.ok) throw new Error("Gagal mengambil metrics");
        const data = await res.json();

        document.getElementById("modelName").textContent =
            data.model;

        document.getElementById("metricMae").textContent =
            data.mae.toFixed(2);

        document.getElementById("metricRmse").textContent =
            data.rmse.toFixed(2);

        document.getElementById("metricMape").textContent =
            data.mape.toFixed(2) + "%";

    } catch (err) {
        console.error(err);
    }
}

async function loadForecast(horizon) {

    document.getElementById("tableWrap").innerHTML =
        `<div class="loading">Memuat...</div>`;

    try {

        const [histRes, fcRes] = await Promise.all([
            fetch(`${API}/api/historical?years=${historyYears}`),
            fetch(`${API}/api/forecast?horizon=${horizon}`)
        ]);

        if (!histRes.ok || !fcRes.ok) {
            throw new Error("API Error");
        }

        const hist = await histRes.json();
        const fc = await fcRes.json();

        renderChart(hist, fc);
        renderTable(fc);

    } catch (err) {

        console.error(err);

        document.getElementById("tableWrap").innerHTML =
            `<div class="loading">Gagal mengambil data.</div>`;
    }
}

function renderChart(hist, fc) {

    const ctx = document
        .getElementById("chart")
        .getContext("2d");

    const labels =
        hist.dates.concat(fc.dates);

    const historicalData =
        hist.close.concat(
            new Array(fc.dates.length).fill(null)
        );

    const forecastData =
        new Array(hist.dates.length - 1)
            .fill(null)
            .concat([
                hist.close[hist.close.length - 1]
            ])
            .concat(fc.forecast);
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Historical Weekly Close",
                    data: historicalData,
                    borderColor: "#60A5FA",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius:4,
                    tension: 0.15
                },

                {
                    label: "Weekly Forecast",
                    data: forecastData,
                    borderColor: "#34D399",
                    backgroundColor: "transparent",
                    borderDash: [4, 4],
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius:6
                }

            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },

            scales: {
                x: {
                    grid: {
                        color: "#232C42"
                    },
                    ticks: {
                        color: "#8B96A8",
                        autoSkip: true,
                        maxTicksLimit: 10,
                        callback: function (value) {
                            const date = new Date(labels[value]);
                            return date.toLocaleDateString(
                                "id-ID",
                                {
                                    day: "numeric",
                                    month: "short"
                                }
                            );
                        }
                    }
                },

                y: {
                    grid: {
                        color: "#232C42"
                    },
                    ticks: {
                        color: "#8B96A8",
                        callback: function (value) {
                            return formatRupiah(value);
                        }
                    }
                }
            },

            plugins: {
                legend: {
                    labels: {
                        color: "#E7ECF3"
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function (context) {
                            const date = new Date(context[0].label);
                            return date.toLocaleDateString(
                                "id-ID",
                                {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric"
                                }
                            );
                        },

                        label: function (context) {
                            return (
                                context.dataset.label +
                                ": " +
                                formatRupiah(context.parsed.y, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })
                            );
                        }
                    }
                }
            }
        }
    });
}

function renderTable(fc) {
    const rows = fc.dates.map((date, i) => {
        const periode = new Date(date).toLocaleDateString(
            "id-ID",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );
        return `
            <tr>
                <td>${periode}</td>
                <td class="value">
                    ${formatRupiah(fc.forecast[i], {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}
                </td>
            </tr>
        `;
    }).join("");

    document.getElementById("tableWrap").innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Periode</th>
                    <th>Prediksi IHSG</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

document
    .getElementById("horizonGroup")
    .addEventListener("click", function (e) {
        const btn = e.target.closest(".horizon-btn");
        if (!btn) return;
        document
            .querySelectorAll(".horizon-btn")
            .forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        loadForecast(Number(btn.dataset.horizon));
    });

document
.getElementById("historyGroup")
.addEventListener("click", function(e){

    const btn = e.target.closest(".history-btn");

    if(!btn) return;

    document
        .querySelectorAll(".history-btn")
        .forEach(b=>b.classList.remove("active"));

    btn.classList.add("active");

    historyYears = Number(btn.dataset.years);

    const activeForecast =
        document.querySelector(".horizon-btn.active");

    loadForecast(
        Number(activeForecast.dataset.horizon)
    );

});

loadMetrics();
loadForecast(12);