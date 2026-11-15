import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const ASSET_DIR = path.join(ROOT, "docs", "presentation", "assets");
const OUTPUT_DIR = path.join(HERE, "output");
const FINAL_PPTX = path.join(ROOT, "SoftGraph_Intelligence_Presentation.pptx");

const COLORS = {
  ink: "#111827",
  body: "#374151",
  muted: "#6B7280",
  line: "#D1D5DB",
  panel: "#F9FAFB",
  accent: "#1E3A8A",
  accentSoft: "#E8EEF9",
  white: "#FFFFFF",
};

const SLIDES = [
  {
    title: "SoftGraph Intelligence",
    subtitle: "A knowledge-graph platform combining fuzzy logic, evolutionary optimization, swarm intelligence, and explainable retrieval.",
    keywords: "KNOWLEDGE GRAPH  ·  FUZZY LOGIC  ·  OPTIMIZATION  ·  EXPLAINABILITY",
    diagram: "01_overview.png",
    section: "PROJECT OVERVIEW",
    takeaway: "From unstructured evidence to an answer whose reasoning can be inspected.",
    titleSlide: true,
  },
  {
    title: "Problem and Motivation",
    section: "WHY SOFTGRAPH",
    diagram: "02_problem.png",
    points: [
      ["Fragmentation", "Documents hide connected knowledge."],
      ["Ambiguity", "Entities and relations remain uncertain."],
      ["Static ranking", "Fixed weights miss changing intent."],
      ["Opacity", "Users cannot inspect answer evidence."],
      ["Goal", "Adaptive, explainable graph retrieval."],
    ],
    takeaway: "The central challenge is reasoning reliably when both data and relevance are uncertain.",
  },
  {
    title: "Knowledge Graph Creation",
    section: "DATA TO GRAPH",
    diagram: "03_graph_creation.png",
    points: [
      ["Input", "Documents, text, JSON, and CSV."],
      ["Processing", "Clean, segment, and normalize evidence."],
      ["Extraction", "Identify entities and candidate relations."],
      ["Validation", "Assign fuzzy confidence to triples."],
      ["Resolution", "Merge duplicates; preserve provenance."],
      ["Storage", "Persist the validated graph."],
    ],
    takeaway: "Every graph edge retains confidence and source provenance for later explanation.",
  },
  {
    title: "Fuzzy Logic Layer",
    section: "UNCERTAINTY HANDLING",
    diagram: "04_fuzzy.png",
    points: [
      ["Inputs", "Similarity, quality, and relation strength."],
      ["Memberships", "Low, medium, and high."],
      ["Rules", "Linguistic IF–THEN inference."],
      ["Models", "Mamdani transparency; Sugeno speed."],
      ["Output", "Defuzzified confidence and relevance."],
    ],
    takeaway: "Fuzzy inference converts ambiguous signals into interpretable confidence scores.",
  },
  {
    title: "Genetic Algorithm Optimization",
    section: "EVOLUTIONARY SEARCH",
    diagram: "05_ga.png",
    points: [
      ["Chromosome", "Encodes ranking weights and thresholds."],
      ["Fitness", "Balances quality, precision, and cost."],
      ["Selection", "Preserves stronger candidate solutions."],
      ["Crossover", "Recombines useful parameter patterns."],
      ["Mutation", "Maintains diversity and exploration."],
      ["Result", "Best validated configuration."],
    ],
    takeaway: "The GA searches the configuration space instead of relying on hand-tuned weights.",
  },
  {
    title: "Swarm Intelligence",
    section: "COLLECTIVE OPTIMIZATION",
    diagram: "06_swarm.png",
    points: [
      ["PSO", "Refines continuous ranking weights."],
      ["ACO", "Discovers strong multi-hop graph paths."],
      ["GWO", "Selects compact, relevant subgraphs."],
      ["WOA", "Searches broad parameter spaces."],
      ["Benefit", "Collective search avoids brittle tuning."],
    ],
    takeaway: "Different swarm methods specialize in weights, paths, subgraphs, and parameters.",
  },
  {
    title: "Hybrid Soft Computing",
    section: "COMBINED INTELLIGENCE",
    diagram: "07_hybrid.png",
    points: [
      ["GA", "Finds promising global regions."],
      ["PSO", "Refines strong candidate values."],
      ["Neuro-fuzzy", "Learns membership behavior from feedback."],
      ["Inference", "Combines symbolic rules with adaptation."],
      ["Outcome", "Robust ranking under uncertainty."],
    ],
    takeaway: "Hybridization joins global exploration, local refinement, and interpretable inference.",
  },
  {
    title: "Intelligent Retrieval",
    section: "QUERY TO EVIDENCE",
    diagram: "08_retrieval.png",
    points: [
      ["Understand", "Detect intent and query entities."],
      ["Seed", "Locate semantic graph entry points."],
      ["Explore", "Expand neighborhoods and ACO paths."],
      ["Score", "Apply fuzzy relevance and optimized weights."],
      ["Rank", "Return evidence-backed candidates."],
      ["Answer", "Present the result with provenance."],
    ],
    takeaway: "Retrieval combines semantic matching, graph structure, uncertainty, and learned weights.",
  },
  {
    title: "Explainability and Applications",
    section: "TRUSTED OUTPUT",
    diagram: "09_explainability.png",
    points: [
      ["Evidence", "Shows supporting source fragments."],
      ["Path", "Visualizes graph reasoning steps."],
      ["Rules", "Exposes fired fuzzy conditions."],
      ["Scores", "Decomposes ranking contributions."],
      ["Applications", "Education, research, decisions, recommendations."],
      ["Trust", "Human-readable explanations enable review."],
    ],
    takeaway: "An answer is useful only when users can trace why it was produced.",
  },
  {
    title: "Complete SoftGraph Architecture",
    section: "END-TO-END SYSTEM",
    diagram: "10_architecture.png",
    points: [
      ["Pipeline", "One modular flow from data to answer."],
      ["Intelligence", "Fuzzy, evolutionary, and swarm layers."],
      ["Transparency", "Evidence, paths, rules, and scores."],
      ["Feedback", "Results improve future inference."],
      ["Takeaway", "Uncertain information becomes explainable knowledge."],
    ],
    takeaway: "SoftGraph is a showable, extensible blueprint for trustworthy intelligent retrieval.",
  },
];

function addText(slide, text, position, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    fontSize: style.fontSize ?? 18,
    typeface: "Arial",
    color: style.color ?? COLORS.body,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
  };
  box.text.verticalAlignment = style.verticalAlignment ?? "top";
  box.text.autoFit = "shrinkText";
  box.text.insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return box;
}

function addRect(slide, position, fill, lineFill = fill, lineWidth = 0) {
  return slide.shapes.add({
    geometry: "rect",
    position,
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

async function readImageBlob(fileName) {
  const bytes = await fs.readFile(path.join(ASSET_DIR, fileName));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function addCommonFrame(slide, item, pageNumber) {
  slide.background.fill = COLORS.white;
  addText(slide, item.section, { left: 70, top: 38, width: 300, height: 18 }, {
    fontSize: 11,
    bold: true,
    color: COLORS.accent,
  });
  addText(slide, String(pageNumber).padStart(2, "0"), { left: 1140, top: 38, width: 70, height: 18 }, {
    fontSize: 11,
    bold: true,
    color: COLORS.muted,
    alignment: "right",
  });
  addRect(slide, { left: 70, top: 70, width: 1140, height: 2 }, COLORS.ink);
  addText(slide, "SoftGraph Intelligence · Soft Computing Course Project", { left: 70, top: 684, width: 620, height: 14 }, {
    fontSize: 10,
    color: COLORS.muted,
  });
}

function addDiagramPanel(slide, blob, titleSlide = false) {
  const panel = titleSlide
    ? { left: 752, top: 112, width: 458, height: 522 }
    : { left: 742, top: 126, width: 468, height: 516 };
  addRect(slide, panel, COLORS.panel, COLORS.line, 1);
  slide.images.add({
    blob,
    contentType: "image/png",
    alt: "SoftGraph architecture flow diagram",
    fit: "contain",
    position: {
      left: panel.left + 22,
      top: panel.top + 22,
      width: panel.width - 44,
      height: panel.height - 44,
    },
  });
}

function addNotes(slide, title) {
  slide.speakerNotes.textFrame.setText(
    `${title}\n\n[Sources]\n- Project brief supplied by the author.\n- Diagram rendered from project-owned Mermaid source via https://mermaid.ink/.\n[/Sources]`,
  );
  slide.speakerNotes.setVisible(true);
}

async function buildTitleSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  addCommonFrame(slide, item, index + 1);
  addText(slide, item.title, { left: 70, top: 142, width: 620, height: 122 }, {
    fontSize: 52,
    bold: true,
    color: COLORS.ink,
    verticalAlignment: "bottom",
  });
  addText(slide, item.subtitle, { left: 70, top: 292, width: 600, height: 104 }, {
    fontSize: 22,
    color: COLORS.body,
  });
  addRect(slide, { left: 70, top: 435, width: 64, height: 4 }, COLORS.accent);
  addText(slide, item.keywords, { left: 70, top: 466, width: 620, height: 48 }, {
    fontSize: 13,
    bold: true,
    color: COLORS.accent,
  });
  addText(slide, item.takeaway, { left: 70, top: 554, width: 620, height: 64 }, {
    fontSize: 18,
    color: COLORS.ink,
  });
  addDiagramPanel(slide, await readImageBlob(item.diagram), true);
  addNotes(slide, item.title);
}

async function buildContentSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  addCommonFrame(slide, item, index + 1);
  addText(slide, item.title, { left: 70, top: 91, width: 635, height: 52 }, {
    fontSize: 36,
    bold: true,
    color: COLORS.ink,
  });

  const rowGap = item.points.length === 6 ? 67 : 76;
  item.points.forEach(([keyword, detail], pointIndex) => {
    const y = 171 + pointIndex * rowGap;
    addText(slide, keyword, { left: 70, top: y, width: 168, height: 30 }, {
      fontSize: 17,
      bold: true,
      color: COLORS.accent,
    });
    addText(slide, detail, { left: 242, top: y, width: 455, height: 34 }, {
      fontSize: 17,
      color: COLORS.body,
    });
    if (pointIndex < item.points.length - 1) {
      addRect(slide, { left: 70, top: y + 42, width: 627, height: 1 }, "#E5E7EB");
    }
  });

  addRect(slide, { left: 70, top: 603, width: 627, height: 45 }, COLORS.accentSoft);
  addText(slide, item.takeaway, { left: 86, top: 614, width: 596, height: 24 }, {
    fontSize: 15,
    bold: true,
    color: COLORS.accent,
  });
  addDiagramPanel(slide, await readImageBlob(item.diagram), false);
  addNotes(slide, item.title);
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const presentation = Presentation.create({
    slideSize: { width: 1280, height: 720 },
  });

  for (const [index, item] of SLIDES.entries()) {
    if (item.titleSlide) {
      await buildTitleSlide(presentation, item, index);
    } else {
      await buildContentSlide(presentation, item, index);
    }
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(OUTPUT_DIR, `${stem}.png`), png);
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(OUTPUT_DIR, `${stem}.layout.json`), await layout.text());
  }

  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await writeBlob(path.join(OUTPUT_DIR, "deck-montage.webp"), montage);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(FINAL_PPTX);
  console.log(JSON.stringify({ slides: SLIDES.length, pptx: FINAL_PPTX, previews: OUTPUT_DIR }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
