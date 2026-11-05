import io
import json
import math
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from PIL import Image  # noqa: E402
from reportlab.lib.pagesizes import A4  # noqa: E402
from reportlab.lib.styles import getSampleStyleSheet  # noqa: E402
from reportlab.lib.units import cm  # noqa: E402
from reportlab.platypus import Image as RLImage  # noqa: E402
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer  # noqa: E402
from shapely.geometry import shape  # noqa: E402

_DIRS = ["leste", "nordeste", "norte", "noroeste", "oeste", "sudoeste", "sul", "sudeste"]
_COLORS = {"low": "#d73027", "medium": "#fee050", "high": "#1a9850"}
_CLASS_PT = {"low": "baixo", "medium": "médio", "high": "alto"}


def direction(dx: float, dy: float) -> str:
    """Direção cardinal (8 setores) de (dx=leste, dy=norte)."""
    if math.hypot(dx, dy) < 1e-9:
        return "central"
    return _DIRS[round(math.degrees(math.atan2(dy, dx)) / 45) % 8]


def recommendations(plot: dict[str, Any], alerts: list[dict[str, Any]]) -> list[str]:
    name, c = plot["name"], shape(plot["geometry"]).centroid
    out = []
    for a in alerts:
        if a["type"] == "patch" and a.get("geometry"):
            p = shape(a["geometry"]).centroid
            d = direction(p.x - c.x, p.y - c.y)
            out.append(f"Mancha de {a['value']:.1f} ha: investigar porção {d} do {name}.")
        elif a["type"] == "drop":
            out.append(f"Verificar {name}: queda de {a['value']:.0f}% no NDVI.")
    return out or ["Sem alertas no período: nenhuma ação necessária."]


def _png(fig: Any) -> io.BytesIO:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf


def _map(plot: dict[str, Any], latest: dict[str, Any], root: Path) -> io.BytesIO:
    (w, s), (e, n) = latest["bounds"]
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.imshow(Image.open(root / latest["pngPath"]), extent=(w, e, s, n), aspect="auto")
    zones = json.loads((root / latest["zonesPath"]).read_text())["features"]
    for z in zones:
        geom = shape(z["geometry"])
        for poly in getattr(geom, "geoms", [geom]):
            if not poly.is_empty:
                x, y = poly.exterior.xy
                ax.plot(x, y, color="black", lw=0.5, alpha=0.6)
    for poly in getattr(g := shape(plot["geometry"]), "geoms", [g]):
        x, y = poly.exterior.xy
        ax.plot(x, y, color="white", lw=1.5)
    ax.set_title("NDVI atual e zonas")
    ax.set_xlabel("longitude")
    ax.set_ylabel("latitude")
    return _png(fig)


def _chart(scenes: list[dict[str, Any]], alerts: list[dict[str, Any]]) -> io.BytesIO:
    pts = sorted((s["date"], s["mean"]) for s in scenes if s.get("mean") is not None)
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.plot([p[0] for p in pts], [p[1] for p in pts], marker="o", color="#1a9850")
    means = dict(pts)
    for a in alerts:
        if a["date"] in means:
            ax.annotate(a["type"], (a["date"], means[a["date"]]), color="#d73027", fontsize=7)
    ax.set_title("NDVI médio por data")
    ax.set_ylabel("NDVI")
    ax.tick_params(axis="x", rotation=60, labelsize=7)
    return _png(fig)


def build_pdf(body: dict[str, Any], root: Path) -> bytes:
    plot, alerts = body["plot"], sorted(body["alerts"], key=lambda a: a["date"])
    st = getSampleStyleSheet()
    buf = io.BytesIO()
    story: list[Any] = [
        Paragraph(f"Relatório do talhão {plot['name']}", st["Title"]),
        Paragraph(f"Área: {plot['areaHa']:.1f} ha", st["Normal"]),
        Spacer(1, 0.4 * cm),
        RLImage(_map(plot, body["latest"], root), width=12 * cm, height=10 * cm),
        RLImage(_chart(body["scenes"], alerts), width=14 * cm, height=7 * cm),
        Paragraph("Alertas", st["Heading2"]),
    ]
    for a in alerts:
        story.append(
            Paragraph(
                f"{a['date']} - {a['type']} ({a['severity']}): {a['value']:.1f}", st["Normal"]
            )
        )
    if not alerts:
        story.append(Paragraph("Nenhum alerta no período.", st["Normal"]))
    story.append(Paragraph("Recomendações", st["Heading2"]))
    story += [Paragraph(f"- {r}", st["Normal"]) for r in recommendations(plot, alerts)]
    SimpleDocTemplate(buf, pagesize=A4, title=f"Relatório {plot['name']}").build(story)
    return buf.getvalue()
