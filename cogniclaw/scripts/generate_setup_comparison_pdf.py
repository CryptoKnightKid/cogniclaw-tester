from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def p(text: str, style):
    return Paragraph(text.replace("\n", "<br/>"), style)


def build_pdf(output_path: Path) -> None:
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontSize=9, leading=12))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], fontSize=13, leading=16, spaceBefore=8, spaceAfter=6))
    styles.add(ParagraphStyle(name="Sub", parent=styles["Heading3"], fontSize=11, leading=14, spaceBefore=6, spaceAfter=4))
    styles.add(ParagraphStyle(name="Cell", parent=styles["BodyText"], fontSize=8.5, leading=11))
    styles.add(ParagraphStyle(name="CellHead", parent=styles["BodyText"], fontSize=8.5, leading=11, textColor=colors.white))

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=landscape(A4),
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    story = []

    story.append(Paragraph("Friend Setup vs Our CogniClaw Setup", styles["Title"]))
    story.append(Paragraph(f"Comparison Date: {datetime.now().strftime('%Y-%m-%d')}", styles["Small"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Scope", styles["Section"]))
    story.append(
        Paragraph(
            "This report compares your friend’s production OpenClaw deployment (from the 7 screenshots you shared) "
            "against our current CogniClaw package in this folder (README.md + install.sh defaults). "
            "Important: our side reflects product defaults, not a live production telemetry snapshot.",
            styles["BodyText"],
        )
    )

    story.append(Paragraph("Executive Summary", styles["Section"]))
    story.append(
        Paragraph(
            "Your friend’s stack is a highly customized, incident-hardened production system optimized for one content-heavy operation. "
            "Our CogniClaw setup is a portable, reusable distribution focused on fast install, broad compatibility, and modular automation. "
            "Friend setup wins on operational maturity and deep integration; our setup wins on maintainability, portability, and onboarding speed.",
            styles["BodyText"],
        )
    )
    story.append(Spacer(1, 8))

    headers = [
        p("Category", styles["CellHead"]),
        p("Friend Setup (from screenshots)", styles["CellHead"]),
        p("Our Setup (this repo)", styles["CellHead"]),
        p("Who Has The Edge", styles["CellHead"]),
    ]

    raw_rows = [
        (
            "Deployment model",
            "Single Hetzner VPS, systemd-managed services, tightly tuned for one workload.",
            "Installer for any OpenClaw host (local/VPS), template-driven workspace.",
            "Friend: production hardening\nOurs: portability",
        ),
        (
            "Auth architecture",
            "OAuth-only (Claude Max), token sync/refresh pipeline, no API keys.",
            "Supports OpenAI token auth + Anthropic/Gemini/Kimi/custom API keys.",
            "Friend: smaller key-leak surface\nOurs: provider flexibility",
        ),
        (
            "Resilience controls",
            "Pre-start config validation, crash watchdog, auto-restore, restart policies.",
            "Automation tiers (minimal/standard/full), health monitors, backups, proactive scripts.",
            "Friend",
        ),
        (
            "Update strategy",
            "Daily 4 AM scripted update with backup, smoke test, rollback.",
            "Manual update command + reinstall flow; less opinionated auto-updates.",
            "Friend",
        ),
        (
            "Data architecture",
            "Neon Postgres (111 tables), DB-backed toggles.",
            "File-backed memory + optional dashboard config.",
            "Friend for scale analytics\nOurs for simplicity",
        ),
        (
            "Integrations",
            "Large external stack: Twitter API, Ghost, YouTube, OpusClip, Nostr, and others.",
            "Generic channels (Discord/Telegram/WhatsApp) + mission-control modules.",
            "Friend for domain depth\nOurs for general use",
        ),
        (
            "Operational governance",
            "Documented hard-won rules from incidents.",
            "General guidance; fewer mandatory runbook constraints.",
            "Friend",
        ),
        (
            "Setup speed/reuse",
            "High complexity and custom context required.",
            "One installer, archetypes, 285+ skills, reusable baseline.",
            "Ours",
        ),
    ]

    rows = [[p(c, styles["Cell"]) for c in row] for row in raw_rows]
    table_data = [headers] + rows

    table = Table(
        table_data,
        colWidths=[50 * mm, 90 * mm, 90 * mm, 45 * mm],
        repeatRows=1,
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3b73")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#C7CEDB")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F7F9FC"), colors.white]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)

    story.append(PageBreak())
    story.append(Paragraph("Pros and Cons", styles["Section"]))

    story.append(Paragraph("Friend Setup - Pros", styles["Sub"]))
    for line in [
        "Strong production safety net (pre-start validation, watchdog, restore/rollback patterns).",
        "High observability and operations discipline (explicit runbooks and incident learnings).",
        "Deep, revenue-oriented integrations and dashboard depth (111-table backend).",
        "OAuth-only workflow can reduce long-lived API key sprawl.",
    ]:
        story.append(Paragraph(f"• {line}", styles["BodyText"]))

    story.append(Spacer(1, 4))
    story.append(Paragraph("Friend Setup - Cons", styles["Sub"]))
    for line in [
        "High complexity and maintenance overhead; many moving parts and custom scripts.",
        "Tightly coupled to one operator/workflow, reducing portability.",
        "Single-VPS concentration risk unless additional failover exists.",
        "No model fallback increases outage risk during provider incidents.",
        "Patch-based OAuth/browser-UA workarounds can break during upstream changes.",
    ]:
        story.append(Paragraph(f"• {line}", styles["BodyText"]))

    story.append(Spacer(1, 6))
    story.append(Paragraph("Our CogniClaw Setup - Pros", styles["Sub"]))
    for line in [
        "Fast onboarding and reusable installer flow across environments.",
        "Flexible auth/provider strategy (token auth and multiple API providers).",
        "Modular automation tiers let teams start simple and scale controls gradually.",
        "Lower operational burden for teams not needing heavy custom integrations.",
        "Good baseline architecture (3-tier memory, skills graph, health modules, mission control option).",
    ]:
        story.append(Paragraph(f"• {line}", styles["BodyText"]))

    story.append(Spacer(1, 4))
    story.append(Paragraph("Our CogniClaw Setup - Cons", styles["Sub"]))
    for line in [
        "Less battle-hardened than your friend’s incident-driven production playbooks.",
        "File-based memory/controls are simpler but weaker than DB-backed ops for complex analytics workflows.",
        "Update and safety controls are present but less strict/opinionated out of the box.",
        "Fewer built-in domain-specific integrations; extra engineering needed for parity.",
    ]:
        story.append(Paragraph(f"• {line}", styles["BodyText"]))

    story.append(Spacer(1, 6))
    story.append(Paragraph("Practical Recommendation", styles["Section"]))
    story.append(
        Paragraph(
            "If your goal is a robust general assistant stack you can install and maintain quickly, keep our CogniClaw base. "
            "If your goal is a high-throughput production content operation, adopt selected patterns from your friend’s setup: "
            "(1) mandatory pre-start schema/config validation, (2) update canary + rollback automation, "
            "(3) explicit incident runbooks, and (4) DB-backed feature toggles for operational controls.",
            styles["BodyText"],
        )
    )

    story.append(Spacer(1, 8))
    story.append(Paragraph("Source Notes", styles["Section"]))
    story.append(Paragraph("Friend side: screenshots (sections 1-14). Our side: README.md and install.sh in this repo.", styles["Small"]))

    doc.build(story)


if __name__ == "__main__":
    output = Path(
        r"c:\Users\essam\.gemini\antigravity\scratch\ag-kit-demo\cogniclaw\Friend-vs-Our-Setup-Comparison-2026-03-12.pdf"
    )
    build_pdf(output)
    print(output)
