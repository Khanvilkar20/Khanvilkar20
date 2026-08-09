// UFO eats your GitHub contributions — animated SVG generator
// Usage: GITHUB_TOKEN=xxx node generate.js <github_username> <output.svg>

const fs = require("fs");

const [, , USERNAME, OUTFILE = "ufo-contributions.svg"] = process.argv;
const TOKEN = process.env.GITHUB_TOKEN;

const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            date
            contributionCount
            color
          }
        }
      }
    }
  }
}`;

async function fetchContributions() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

function buildGrid(weeks) {
  return weeks.map((w) => w.contributionDays.map((d) => ({ count: d.contributionCount, color: d.color })));
}

function buildPath(grid) {
  const path = [];
  for (let col = 0; col < grid.length; col++) {
    const rows = [...Array(grid[col].length).keys()];
    if (col % 2 === 1) rows.reverse();
    for (const row of rows) {
      path.push({ col, row });
    }
  }
  return path;
}

const CELL = 12;
const GAP = 3;
const PITCH = CELL + GAP;
const PAD = 20;

function cellCenter(col, row) {
  return { x: PAD + col * PITCH + CELL / 2, y: PAD + row * PITCH + CELL / 2 };
}

function renderSVG(grid, path) {
  const cols = grid.length;
  const rows = Math.max(...grid.map((c) => c.length));
  const width = PAD * 2 + cols * PITCH;
  const height = PAD * 2 + rows * PITCH + 40;

  const totalDuration = Math.max(path.length * 0.08, 4);
  const stepDur = totalDuration / path.length;

  let rects = "";
  let motionPoints = [];

  path.forEach((p, i) => {
    const { x, y } = cellCenter(p.col, p.row);
    motionPoints.push(`${x},${y - 14}`);
    const cell = grid[p.col][p.row];
    const cx = PAD + p.col * PITCH;
    const cy = PAD + p.row * PITCH;

    rects += `
    <rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" rx="2" fill="${cell.color}">
      <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${(i / path.length).toFixed(4)};${Math.min((i / path.length) + 0.02, 1).toFixed(4)};1"
        dur="${totalDuration}s" repeatCount="indefinite" begin="0s" />
    </rect>`;
  });

  const motionPath = "M" + motionPoints.join(" L");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    .bg { fill: transparent; }
    .ufo-body { fill: #b3b3b3; stroke: #7a7a7a; stroke-width: 1; }
    .ufo-dome { fill: #7fd4ff; stroke: #4aa8dd; stroke-width: 1; opacity: 0.9; }
    .beam { fill: #ffe066; opacity: 0; }
  </style>
  <rect class="bg" x="0" y="0" width="${width}" height="${height}" />
  ${rects}
  <g id="ufo">
    <ellipse class="beam" cx="0" cy="10" rx="6" ry="18">
      <animate attributeName="opacity" values="0;0.55;0" dur="${stepDur}s" repeatCount="indefinite" />
    </ellipse>
    <ellipse class="ufo-body" cx="0" cy="0" rx="14" ry="5" />
    <path class="ufo-dome" d="M -7,-2 Q 0,-12 7,-2 Z" />
    <animateMotion dur="${totalDuration}s" repeatCount="indefinite" path="${motionPath}" />
  </g>
</svg>`;
  return svg;
}

async function main() {
  if (!USERNAME || !TOKEN) {
    console.error("Usage: GITHUB_TOKEN=xxx node generate.js <username> <output.svg>");
    process.exit(1);
  }
  const weeks = await fetchContributions();
  const grid = buildGrid(weeks);
  const path = buildPath(grid);
  const svg = renderSVG(grid, path);
  fs.writeFileSync(OUTFILE, svg);
  console.log(`Written ${OUTFILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
