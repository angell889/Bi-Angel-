fetch("./ventas_raw.csv")
    .then(res => {
        if (!res.ok) throw new Error("No se pudo cargar el CSV");
        return res.text();
    })
    .then(text => procesarCSV(text))
    .catch(err => {
        document.body.innerHTML =
            "<h2>Error cargando ventas_raw.csv</h2>" +
            "<p>Comprueba que el archivo está en la raíz del repositorio.</p>";
        console.error(err);
    });

function procesarCSV(texto) {
    const filas = texto.trim().split("\n");
    const headers = filas[0].split(",");

    const datosRaw = filas.slice(1).map(fila => {
        const valores = fila.split(",");
        let obj = {};
        headers.forEach((h, i) => obj[h.trim()] = valores[i]?.trim());
        return obj;
    });

    mostrarInfoFilas(datosRaw.length, null);
    mostrarTabla("tablaRaw", datosRaw.slice(0, 10));

    const datosClean = limpiarDatos(datosRaw);

    mostrarInfoFilas(datosRaw.length, datosClean.length);
    mostrarTabla("tablaClean", datosClean.slice(0, 10));

    calcularKPIs(datosClean);
    mostrarKPIsDetallados(datosClean);
    crearGraficos(datosClean);
    prepararDescarga(datosClean);
}

// Limpieza de datos
function limpiarDatos(datos) {
    const vistos = new Set();
    const resultado = [];

    datos.forEach(d => {
        const fecha = new Date(d.fecha);
        if (isNaN(fecha)) return;

        let franja = d.franja?.toLowerCase();
        franja = franja.includes("desa") ? "Desayuno" :
                 franja.includes("com") ? "Comida" : null;
        if (!franja) return;

        let familia = d.familia?.toLowerCase();
        familia =
            familia.includes("beb") ? "Bebida" :
            familia.includes("entr") ? "Entrante" :
            familia.includes("prin") ? "Principal" :
            familia.includes("post") ? "Postre" : null;
        if (!familia) return;

        let producto = d.producto?.trim().toLowerCase();
        if (!producto) return;

        const unidades = Number(d.unidades);
        const precio = Number(d.precio_unitario);
        if (unidades <= 0 || precio <= 0) return;

        const importe = unidades * precio;

        const fila = {
            fecha: fecha.toISOString().split("T")[0],
            franja,
            producto,
            familia,
            unidades,
            precio_unitario: precio,
            importe
        };

        const clave = JSON.stringify(fila);
        if (vistos.has(clave)) return;
        vistos.add(clave);

        resultado.push(fila);
    });

    return resultado;
}

// KPIs principales
function calcularKPIs(datos) {
    const ventas = datos.reduce((a, b) => a + b.importe, 0);
    const unidades = datos.reduce((a, b) => a + b.unidades, 0);

    document.getElementById("kpiVentas").innerHTML =
        `<strong>Ventas totales</strong><br>${ventas.toFixed(2)} €`;

    document.getElementById("kpiUnidades").innerHTML =
        `<strong>Unidades totales</strong><br>${unidades}`;
}

// KPIs detallados
function mostrarKPIsDetallados(datos) {
    const porProducto = agrupar(datos, "producto");
    const porFranja = agrupar(datos, "franja");
    const porFamilia = agrupar(datos, "familia");

    const topProductos = Object.entries(porProducto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    rellenarLista("kpiTopProductos", topProductos);
    rellenarLista("kpiFranja", Object.entries(porFranja));
    rellenarLista("kpiFamilia", Object.entries(porFamilia));
}

// Gráficos con colores azules y estilo
function crearGraficos(datos) {
    const porProducto = agrupar(datos, "producto");
    const topProductos = Object.entries(porProducto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    new Chart(chartTopProductos, {
        type: "bar",
        data: {
            labels: topProductos.map(p => p[0]),
            datasets: [{
                label: "Importe (€)",
                data: topProductos.map(p => p[1]),
                backgroundColor: "#004080",
                borderRadius: 5
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                title: { display: true, text: "Top 5 Productos", font: { size: 16 } }
            },
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    const colores = ["#004080","#0066cc","#3399ff","#99ccff"];

    new Chart(chartFranja, {
        type: "pie",
        data: {
            labels: Object.keys(agrupar(datos, "franja")),
            datasets: [{ data: Object.values(agrupar(datos, "franja")), backgroundColor: colores }]
        }
    });

    new Chart(chartFamilia, {
        type: "pie",
        data: {
            labels: Object.keys(agrupar(datos, "familia")),
            datasets: [{ data: Object.values(agrupar(datos, "familia")), backgroundColor: colores }]
        }
    });
}

// Utilidades
function agrupar(datos, campo) {
    return datos.reduce((acc, d) => {
        acc[d[campo]] = (acc[d[campo]] || 0) + d.importe;
        return acc;
    }, {});
}

function rellenarLista(id, datos) {
    const ul = document.getElementById(id);
    ul.innerHTML = "";
    datos.forEach(d => {
        const li = document.createElement("li");
        li.textContent = `${d[0]}: ${d[1].toFixed(2)} €`;
        ul.appendChild(li);
    });
}

function mostrarTabla(id, datos) {
    const tabla = document.getElementById(id);
    tabla.innerHTML = "";
    if (!datos.length) return;

    const trHead = document.createElement("tr");
    Object.keys(datos[0]).forEach(k => {
        const th = document.createElement("th");
        th.textContent = k;
        trHead.appendChild(th);
    });
    tabla.appendChild(trHead);

    datos.forEach(f => {
        const tr = document.createElement("tr");
        Object.values(f).forEach(v => {
            const td = document.createElement("td");
            td.textContent = v;
            tr.appendChild(td);
        });
        tabla.appendChild(tr);
    });
}

function mostrarInfoFilas(raw, clean) {
    document.getElementById("infoFilas").textContent =
        clean === null
            ? `Filas RAW: ${raw}`
            : `Filas RAW: ${raw} | Filas limpias: ${clean}`;
}

function prepararDescarga(datos) {
    document.getElementById("downloadBtn").onclick = () => {
        const headers = Object.keys(datos[0]).join(",");
        const filas = datos.map(d => Object.values(d).join(","));
        const csv = [headers, ...filas].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "ventas_clean.csv";
        a.click();
        URL.revokeObjectURL(url);
    };
}
