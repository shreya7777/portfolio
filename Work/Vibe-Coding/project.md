# Building Insight Digest, a Figma research plugin

## My Role

I'm building a Figma plugin called Insight Digest — one of a handful of small AI-assisted tools I've been building to speed up my own research and design workflow. Our team's customer-research board is a sprawling FigJam-style canvas — sticky notes, tags, and quotes scattered across dozens of modules — and pulling a clean, sortable summary out of it by hand takes forever. The plugin reads that board and turns it into a structured, sortable digest table automatically.

The real trigger was speed: our IA research had been moving fast and living in an interim format for months, and it was getting genuinely hard to track what was where and who said what — with no way to generate a clean readout or report from it. Around the same time I heard about building plugins through AI agents and figured it might be the fix. What I actually wanted from it: segment insights by module, by topic, and by priority; sort them by status (WIP, Done, etc.); attach customer and internal-stakeholder quotes to each one; and eventually run a research intake through it too. Even while scoping it, I had to ask myself — am I expecting one plugin to do too much?

I tried two different ways of building it:

- Method 1: Figma Agent | Multi-modal, working directly inside Figma's agentic mode with Claude Sonnet/Opus + Gemini + GPT.
- Method 2: VS Code + Copilot | Claude Sonnet 4.6 with GitHub Copilot and Figma MCP — a longer path, but one where I could actually read, edit, and scale the code.

## Building the Plugin

Every prompt followed the same shape: [trigger/input] + [instructions] + [desired output]. For Method 2 I started in plan mode to pressure-test feasibility before writing any code:

> Identify the key modules, files, and dependencies needed. Recommend technical approaches and frameworks. Outline the step-by-step build order. Highlight potential technical risks, edge cases, or missing information before implementation.

The research board has a real hierarchy — page, module, topic, insight, customer quote, metadata tags, and a separate customer-questions table — and I mapped all of it out explicitly in the prompt rather than letting the plugin guess. I also asked for a defensive, modular architecture split across dedicated files instead of one big script:

- index.ts | Pipeline coordinator — runs every sub-parser, then the association phase (tags → insights → topics).
- module-parser.ts | Finds the top-level section nodes that represent each module.
- topic-parser.ts | Finds topic labels using a border/style heuristic.
- insight-parser.ts | Finds stickies — both sticky nodes and styled frame nodes standing in for them.
- tag-parser.ts | Finds the floating tag pills that sit outside the stickies themselves.
- quote-parser.ts & question-parser.ts | Pulls Customer Quote components and extracts rows straight out of the questions table.

Every parser got the same defensive rule: verify data types, boundaries, and structure explicitly before use — skip a node rather than crash on it, and never call a string method on something that might be undefined.

The prompting had its own rhythm too: give the agent explicit information on how I wanted the output to turn out (pulling in outside prompting resources to get that part right), define the metadata that becomes the table's headers as the foundation, test whether each output actually matched the original board data, and iterate by researching a way around whatever roadblock came up next.

- Good at | Structural reading — understanding frames, sections, and how layers relate to each other, plus native Figma plugin API calls.
- Bad at | Semantic inference and reasoning, and reliably reading every content type without extra help.

Getting a tag, quote, or status linked to the right sticky came down to how I structured the prompt: anchor by structure first — section, frame, component — then ask for semantic linking on top of that (labels, IDs, repeated terms, status icons), and ask for a confidence score whenever the hierarchy or proximity is weak. In priority order, that meant reading explicit links, nesting hierarchy, frame and section boundaries, component and variant semantics, text and IDs, geometry, proximity, and finally appearance similarity.

## Debugging & Verification

The board is messy on purpose — real research always is — so the plugin couldn't just match on exact layer names. It reads structure first (page → module → topic), then falls back to geometry and visual proximity — how close a tag sits to a sticky, how close a quote sits to its insight — when structure alone isn't enough.

![Debugging the plugin's tag classification with the coding agent, using placeholder sticky data](Work/Vibe-Coding/agent-debugging-sample.png)

A lot of the debugging happened in conversation with the agent directly — pointing it at a sample sticky, asking it to read the tags sitting on top of it, and confirming the width-based classification (a 125px-wide pill reads as "Pain point", 123px reads as "Low priority") actually matched what I was seeing on the board.

- Method 1 | Couldn't associate metadata tags with sticky notes at first — it was reading layers, not visual proximity. Reprompting it to use visual proximity between tags and stickies fixed that, though it still can't run sort/filter logic since those code layers don't exist yet.
- Method 2 | A longer road to a working plugin, but one where I could actually read, change, and scale the code as the board's structure evolved.

Two roadblocks stood out along the way:

- Quote Extraction | The Plugin API sandbox doesn't expose the full customer-quote text, since it lives inside FigJam widget nodes — so I called the Figma REST API instead, which reads the actual text inside each Customer Quote widget. Without it, quotes still get detected by proximity, just marked "(quote on board)" instead of the full text.
- Sortable Table | Making the digest table sortable by module, topic, type, priority, and status needs real interactivity on code layers, which agentic mode alone can't build yet. Still unsolved — Figma Make or a return to the Method 2 path are next up.

## Results

- 48 | Insights extracted | Pulled automatically from one research board in a single run.
- 21 | Customer quotes matched | Linked back to their nearest insight by proximity.
- 5 | Association rules | Each with its own proximity threshold, from tag-to-sticky matching to topic detection.

Here's what actually happens when you click Generate digest:

- Search & Extract | Scans the current page for a section matching the research field, then pulls every insight from sticky notes across each module inside it.
- Classify | Reads tag pixel-width to sort into High / Medium / Low priority, Pain point, Desired feature, or Needs refinement.
- Detect | Finds topics from shape-and-text nodes by proximity, and status from emoji cues (🚧 WIP, ✅ Done, ❓ Unknown).
- Build & Summarize | Sorts everything by priority then topic, builds the Insight Digest table on canvas, and shows a colour-coded summary in the panel.

## What's Next

Checking the plugin against my original goals was clarifying:

- ✅ Segment insights by module, topic, and priority
- ✅ Attach customer and internal-stakeholder quotes
- ❌ Sort insights by status
- ❌ Run a full research intake through the plugin

Along the way I also learned that Bizra.io could end up being a real competitor in this exact space — worth studying closely.

- Make the plugin's output look genuinely presentable, not just functional
- Apply real sorting logic across module, topic, type, priority, and status
- Add the ability to edit status directly through the plugin — the hardest one on this list
- Study Bizra.io closely
- Import directly from CSV exports (Dscout) and Dovetail transcripts
- Run the plugin on any design file to surface relevant, filtered research insights as a suggestive to-do list

Was it worth it? Honestly — yes, even with the gaps. I expected agentic mode to handle more than it could, and I was right to wonder about that going in. But structure-first reading, a geometry fallback, and the REST API workaround got me most of the way to a real tool — and that's the throughline across every plugin I build this way: read structure first, then geometry and context second.

# Images
