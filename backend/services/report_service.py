import io
from datetime import datetime
from typing import Dict, Any, List, Optional
from xml.sax.saxutils import escape
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak
)

def generate_pdf_report(
    summary_data: Dict[str, Any],
    benchmarks: List[Dict[str, Any]],
    forecasts: List[Dict[str, Any]],
    reliability: Dict[str, Any],
    forecast_unavailable_reason: str = "No forecast has been generated or is available for this dataset.",
    scope_context: Optional[Dict[str, Any]] = None,
) -> bytes:
    """Generates an executive report using active-dataset facts and available calculations."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40, leftMargin=40,
        topMargin=40, bottomMargin=40
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        spaceAfter=15
    )
    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155')
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#1E293B')
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("AI-Based Retail Sales Prediction & Forecasting Platform", title_style))
    story.append(Paragraph(
        f"Executive Analytics Report & Model Evaluation | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Dataset: {escape(str(summary_data.get('original_filename', 'Active dataset')))}",
        subtitle_style
    ))
    story.append(Spacer(1, 10))

    # Executive Summary Card
    story.append(Paragraph("1. Executive Dataset Summary", heading_style))
    sum_data = [
        ["Total Historical Sales", f"${summary_data.get('total_sales', 0):,.2f}", "Total Stores", str(summary_data.get('total_stores', 45))],
        ["Mean Weekly Sales", f"${summary_data.get('mean_weekly_sales', 0):,.2f}", "Total Records", f"{summary_data.get('total_rows', 0):,}"],
        ["Min Date", str(summary_data.get('min_date', 'Unavailable')), "Max Date", str(summary_data.get('max_date', 'Unavailable'))],
        ["Integrity Verification", f"{summary_data.get('missing_cells', 'N/A')} missing / {summary_data.get('duplicate_rows', 'N/A')} duplicate rows", "Dataset SHA-256", f"{summary_data.get('sha256', '')[:16]}..."]
    ]
    t_sum = Table(sum_data, colWidths=[130, 130, 130, 140])
    t_sum.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1E293B')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    story.append(t_sum)
    story.append(Spacer(1, 12))

    story.append(Paragraph("2. Dataset Coverage & Available Analytics", heading_style))
    scope_context = scope_context or {}
    selected_store = scope_context.get("store_id")
    requested_model = escape(str(scope_context.get("model_name") or "Not selected"))
    requested_date = escape(str(scope_context.get("forecast_date") or "Not selected"))
    date_mode = escape(str(scope_context.get("date_mode") or "Not specified"))
    story.append(Paragraph(
        f"Active source: {summary_data.get('original_filename', 'Active dataset')}. "
        f"Report scope: {f'Store {selected_store}' if selected_store is not None else 'All stores'}; "
        f"requested model: {requested_model}; target date: {requested_date} ({date_mode} mode). "
        f"{summary_data.get('total_rows', 0):,} records across "
        f"{summary_data.get('total_stores', 0)} stores, spanning "
        f"{summary_data.get('min_date', 'Unavailable')} to {summary_data.get('max_date', 'Unavailable')}. "
        f"Mean weekly store sales: ${summary_data.get('mean_weekly_sales', 0):,.2f}; "
        f"median: ${summary_data.get('median_weekly_sales', 0):,.2f}.",
        body_style,
    ))
    story.append(Spacer(1, 10))

    # 3. Benchmark Comparison
    story.append(Paragraph("3. Active Dataset Chronological Holdout Model Evaluation", heading_style))
    if not benchmarks:
        story.append(Paragraph(
            "Model-comparison analytics are unavailable because the active dataset does not contain enough "
            "supervised history for a chronological model evaluation. No accuracy metrics are reported.",
            body_style,
        ))
    bench_table_data = [["Model Name", "Type", "MAE (USD)", "RMSE (USD)", "WAPE (%)", "R² Score"]]
    for row in benchmarks:
        bench_table_data.append([
            row.get("Model", ""),
            row.get("Type", "ML"),
            f"${row.get('MAE', 0):,.2f}",
            f"${row.get('RMSE', 0):,.2f}",
            f"{row.get('WAPE (%)', 0):.2f}%",
            f"{row.get('R2', 0):.4f}" if row.get('R2') is not None else "N/A"
        ])
    t_bench = Table(bench_table_data, colWidths=[140, 90, 80, 80, 70, 70])
    t_bench.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F1F5F9')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_bench)
    story.append(Spacer(1, 12))

    # 4. Forecast Reliability
    story.append(Paragraph("4. Empirical Prediction Band Reliability & Caveats", heading_style))
    workflows = reliability.get("workflows", [])
    workflow = workflows[0] if workflows else {}
    coverage = workflow.get("overall_coverage")
    mean_width = workflow.get("mean_width_usd")
    reliability_text = (
        f"Empirical coverage: {coverage:.2f}%; mean interval width: ${mean_width:,.2f}. "
        "These values describe the supplied evaluation results and do not guarantee future or per-store coverage."
        if coverage is not None and mean_width is not None
        else "Prediction-interval reliability was unavailable for this active dataset; no coverage claim is made."
    )
    story.append(Paragraph(reliability_text, body_style))
    story.append(Spacer(1, 12))

    # 5. Forecast Results
    fc_date = forecasts[0].get("Forecast_Date") if forecasts else None
    forecast_model = forecasts[0].get("Status", "Available forecast") if forecasts else None
    story.append(Paragraph(
        f"5. Forecast Results{f' — {fc_date}' if fc_date else ''}",
        heading_style,
    ))
    if not forecasts:
        story.append(Paragraph(
            f"No forecast results are included. {forecast_unavailable_reason} "
            "The report contains dataset information and available analytics only.",
            body_style,
        ))
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    story.append(Paragraph(
        f"Method: {forecast_model}. Stores forecasted: {len(forecasts)}. "
        "Prediction bounds are included only when supported by calibration.",
        body_style,
    ))
    fc_table_data = [["Store", "Forecast (USD)", "90% Lower Bound", "90% Upper Bound", "13W Prior Mean", "Shift (%)", "Alert Status"]]
    # Top 15 stores preview
    def format_bound(value):
        return f"${value:,.2f}" if value is not None else "Unavailable"

    def format_percent(value):
        return f"{value:+.1f}%" if value is not None else "Unavailable"

    for row in forecasts[:15]:
        fc_table_data.append([
            f"Store {row.get('Store')}",
            format_bound(row.get('Forecast_Sales')),
            format_bound(row.get('Lower_Bound')),
            format_bound(row.get('Upper_Bound')),
            format_bound(row.get('Prior_13W_Mean')),
            format_percent(row.get("Change_vs_Mean_Pct")),
            row.get('Alert', 'UNAVAILABLE')
        ])
    t_fc = Table(fc_table_data, colWidths=[65, 85, 85, 85, 85, 60, 65])
    t_fc.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_fc)
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        f"<i>Showing {min(15, len(forecasts))} of {len(forecasts)} store forecasts. "
        "Intervals are marked unavailable unless calibrated on earlier data.</i>",
        body_style,
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

def generate_forecasts_csv(forecasts: List[Dict[str, Any]]) -> str:
    df = pd.DataFrame(forecasts)
    return df.to_csv(index=False)
