"""Operational domain demonstrations. All examples are fictional, not professional advice."""

DOMAIN_PROFILES = {
    "ration": {
        "name": "Ration Saathi", "category": "Public ration help",
        "description": "Trace ration guidance through source documents.",
        "concepts": ["One Nation One Ration Card", "Existing NFSA Card", "Portability Claim", "Monthly Entitlement",
                     "State Food Portal", "NFSA Application Directory", "NFSA Complaint Directory", "State Grievance Portal",
                     "Fair Price Shop Lookup", "Mera Ration App"],
        "questions": ["How is Existing NFSA Card related to Portability Claim?"],
        "examples": [("Fictional document for upload", "Existing NFSA Card supports Portability Claim. Portability Claim uses Monthly Entitlement.")],
    },
    "healthcare": {
        "name": "Care Evidence", "category": "Healthcare operations",
        "description": "Connect care handoffs, approved procedures and evidence review without patient records.",
        "concepts": ["Care Handoff", "Referral Queue", "Discharge Checklist", "Evidence Review", "Care Coordinator", "Medication Reconciliation", "Follow Up Plan", "Procedure Library"],
        "questions": ["How does Care Handoff use Discharge Checklist?", "How is Referral Queue related to Follow Up Plan?", "How does Evidence Review support Procedure Library?"],
        "examples": [
            ("Ward handoff · fictional workflow", "# Ward handoff\nFictional healthcare operations example. No patient data or clinical recommendations.\nCare Handoff uses Discharge Checklist.\nDischarge Checklist supports Follow Up Plan.\nCare Coordinator supports Care Handoff."),
            ("Referral coordination · fictional workflow", "# Referral coordination\nFictional workflow documentation.\nReferral Queue supports Care Coordinator.\nCare Coordinator supports Follow Up Plan.\nFollow Up Plan uses Procedure Library."),
            ("Procedure evidence · fictional workflow", "# Procedure evidence\nFictional evidence-review workflow, not a validated clinical guideline.\nEvidence Review supports Procedure Library.\nMedication Reconciliation uses Discharge Checklist.\nProcedure Library supports Care Handoff."),
            ("Open care review · fictional hypothesis", "# Open care review\nFictional hypothesis requiring review.\nMedication Reconciliation might improve Referral Queue.\nThis hypothesis is not accepted as a graph relationship.")],
    },
    "agriculture": {
        "name": "Field Atlas", "category": "Agriculture planning",
        "description": "Trace field observations through irrigation plans, crop records and inspection notes.",
        "concepts": ["Field Observation", "Soil Moisture", "Irrigation Plan", "Weather Record", "Crop Schedule", "Pest Inspection", "Field Notebook", "Water Budget"],
        "questions": ["How does Irrigation Plan use Soil Moisture?", "How is Pest Inspection related to Crop Schedule?", "How does Weather Record support Water Budget?"],
        "examples": [
            ("North field · fictional irrigation plan", "# North field\nFictional planning example. No live sensors, dosage advice or yield forecasts.\nIrrigation Plan uses Soil Moisture.\nSoil Moisture supports Field Observation.\nField Observation supports Water Budget."),
            ("Season planning · fictional records", "# Season planning\nFictional agronomy documentation.\nWeather Record supports Water Budget.\nWater Budget supports Irrigation Plan.\nCrop Schedule uses Weather Record."),
            ("Crop inspection · fictional notebook", "# Crop inspection\nFictional inspection workflow. No pest diagnosis.\nPest Inspection uses Field Notebook.\nField Notebook supports Crop Schedule.\nField Observation supports Pest Inspection."),
            ("Unconfirmed field trend", "# Unconfirmed field trend\nFictional hypothesis requiring a field review.\nSoil Moisture might improve Crop Schedule.\nA correlation is not an accepted operational recommendation.")],
    },
    "finance": {
        "name": "Ledger Intelligence", "category": "Finance controls",
        "description": "Connect counterparty reviews, exposure documentation and audit evidence.",
        "concepts": ["Counterparty Review", "Exposure Register", "Liquidity Review", "Audit Trail", "Risk Committee", "Control Checklist", "Treasury Policy", "Evidence Register"],
        "questions": ["How does Counterparty Review use Exposure Register?", "How is Liquidity Review related to Risk Committee?", "How does Control Checklist support Audit Trail?"],
        "examples": [
            ("Counterparty file · fictional controls", "# Counterparty file\nFictional finance operations example, not an investment recommendation.\nCounterparty Review uses Exposure Register.\nExposure Register supports Risk Committee.\nEvidence Register supports Counterparty Review."),
            ("Treasury review · fictional controls", "# Treasury review\nFictional treasury workflow. No market data or return predictions.\nLiquidity Review uses Treasury Policy.\nTreasury Policy supports Risk Committee.\nRisk Committee uses Evidence Register."),
            ("Audit preparation · fictional controls", "# Audit preparation\nFictional control documentation.\nControl Checklist supports Audit Trail.\nAudit Trail uses Evidence Register.\nEvidence Register supports Exposure Register."),
            ("Unverified exposure hypothesis", "# Unverified exposure hypothesis\nFictional hypothesis requiring documented review.\nLiquidity Review might improve Counterparty Review.\nThis statement does not establish a risk rating.")],
    },
}

# Heuristic configurations, not learned weights or calibrated confidence.
POLICIES = {
    "ration": {"name": "Ration documents", "weights": (.65, .20, .15), "top_k": 5, "max_hops": 4,
               "view": "cards", "focus": "Favor document wording and evidence-linked workflow paths."},
    "healthcare": {"name": "Evidence first", "weights": (.65, .20, .15), "top_k": 4, "max_hops": 2, "view": "list", "focus": "Prioritize explicit source matches and short evidence paths."},
    "agriculture": {"name": "Context explorer", "weights": (.45, .25, .30), "top_k": 6, "max_hops": 3, "view": "cards", "focus": "Give fuzzy relevance more weight when inspecting contextual records."},
    "engineering": {"name": "Dependency tracer", "weights": (.45, .40, .15), "top_k": 5, "max_hops": 4, "view": "list", "focus": "Give documented graph dependencies more influence in ranking."},
    "finance": {"name": "Audit precision", "weights": (.70, .20, .10), "top_k": 4, "max_hops": 2, "view": "list", "focus": "Favor exact documentary matches for control and exposure review."},
    "personal": {"name": "Connection explorer", "weights": (.55, .30, .15), "top_k": 5, "max_hops": 3, "view": "cards", "focus": "Balance source matches with documented note connections."},
    "course": {"name": "Course baseline", "weights": (.60, .25, .15), "top_k": 5, "max_hops": 3, "view": "cards", "focus": "Use the existing evaluated course retrieval baseline."},
}
