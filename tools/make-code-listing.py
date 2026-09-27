#!/usr/bin/env python3
"""
Builds the code listing PDF that Task 10.2D asks for: the html, css and
JavaScript of every page improved in Part 3, with the server code behind
them, in one document.

Run from the project root:

    python tools/make-code-listing.py [output.pdf]
    python tools/make-code-listing.py --all [output.pdf]     (10.3HD, adds Auto-Party)

What the reader gets:

  - a "Where to find it" table at the front, linking each improvement to
    the file and line that does it;
  - a contents page with page numbers, every entry a link;
  - PDF bookmarks, so the viewer's sidebar can jump to any file;
  - each file marked New or Changed in Part 3, with a line saying what it is;
  - the code on a light grey panel, coloured as an editor colours it, with
    the file's own line numbers in a darker strip down the left.

Which files are listed, what each is called, and the "Where to find it"
table all come from tools/listing.txt, so changing the PDF means editing
that file, not this one.

Needs Python with reportlab, and pygments for the colouring:
    pip install reportlab pygments
Without pygments the listing is still produced, in one colour.
"""

import os
import sys
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

try:
    from pygments import lex
    from pygments.lexers import CssLexer, HtmlLexer, JavascriptLexer
    from pygments.token import Token
    COLOURING = True
except ImportError:
    COLOURING = False


ALL = "--all" in sys.argv
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "listing.txt")

TITLE = "Oceania Adventure Guild"
SUBTITLE = "Code listing, SIT774 Task 10.3HD" if ALL else "Code listing, SIT774 Task 10.2D"
AUTHOR = "Hassan Mohamed, student ID 226283244"

# The Auto-Party files belong to Task 10.3HD, and are left out of the
# 10.2D listing unless --all is given.
AUTO_PARTY_FILES = {"routes/auto-party.js", "public/js/auto-party.js"}


# ----------------------------------------------------------------------
# Page and type
# ----------------------------------------------------------------------

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 15 * mm
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

FONT_SIZE = 7.5
LEADING = 9.2
CHAR_WIDTH = FONT_SIZE * 0.6        # Courier: every character is 0.6 em wide
GUTTER = 26                         # the line number strip, in points
CODE_PAD = 6                        # space between the strip and the code
BLOCK_PAD = 5                       # space above and below the code

CODE_CHARS = int((CONTENT_WIDTH - GUTTER - CODE_PAD - 4) / CHAR_WIDTH)

GREEN = colors.HexColor("#1F4A32")
GREY_TEXT = colors.HexColor("#555555")
PANEL = colors.HexColor("#F2F3F5")   # the code panel
STRIP = colors.HexColor("#E2E5E9")   # the line number strip
NUMBER = colors.HexColor("#5F6670")  # line numbers
LINK = colors.HexColor("#1F4A32")

# Colours for the code, chosen to read clearly on the grey panel and to
# stay distinguishable when printed. Each is a font and a colour.
INK = ("Courier", colors.HexColor("#1F2328"))
STYLES = {
    "comment":   ("Courier-Oblique", colors.HexColor("#56626B")),
    "keyword":   ("Courier-Bold", colors.HexColor("#0B3D91")),
    "tag":       ("Courier-Bold", colors.HexColor("#0B3D91")),
    "attribute": ("Courier", colors.HexColor("#7A1FA2")),
    "string":    ("Courier", colors.HexColor("#1E6B2F")),
    "number":    ("Courier", colors.HexColor("#9A3412")),
    "function":  ("Courier", colors.HexColor("#00627A")),
    "ink":       INK,
}


# ----------------------------------------------------------------------
# Reading tools/listing.txt
# ----------------------------------------------------------------------

def read_manifest():
    parts = {"describe": {}, "changed": {}, "unchanged": [], "appendix": [], "map": []}
    part = None

    with open(MANIFEST, encoding="utf-8") as handle:
        for raw in handle:
            line = raw.rstrip("\n")
            text = line.strip()

            if not text or (text.startswith("#") and not text.startswith("##")):
                continue

            if text.startswith("[") and text.endswith("]"):
                part = text[1:-1]
                continue

            if part == "describe" and "|" in text:
                path, words = text.split("|", 1)
                parts["describe"][path.strip()] = words.strip()
            elif part == "changed":
                path, _, note = text.partition("|")
                parts["changed"][path.strip()] = note.strip()
            elif part in ("unchanged", "appendix"):
                parts[part].append(text)
            elif part == "map":
                if text.startswith("##"):
                    parts["map"].append(("group", text[2:].strip()))
                    continue
                cells = [c.strip() for c in line.split("|")]
                if len(cells) == 3:
                    name, path, anchor = cells
                    if name:
                        parts["map"].append(("item", name, []))
                    if parts["map"] and parts["map"][-1][0] == "item":
                        parts["map"][-1][2].append((path, anchor))

    return parts


def listed_files(parts):
    """The files to print, in sections, as (section, [paths]) pairs, plus
    the appendix. Unchanged files are left out, and so is Auto-Party
    unless --all."""

    def keep(path):
        return (os.path.isfile(path)
                and path not in parts["unchanged"]
                and path not in parts["appendix"]
                and (ALL or path not in AUTO_PARTY_FILES))

    def folder(name, ext):
        return sorted(name + "/" + f for f in os.listdir(name) if f.endswith(ext)) \
            if os.path.isdir(name) else []

    sections = [
        ("Server and database", ["server.js", "create.js", "seed.js", "display.js"]),
        ("API routes", folder("routes", ".js")),
        ("Pages served to anyone", folder("public", ".html")),
        ("Pages that need a login", folder("views", ".html")),
        ("Stylesheet", folder("public/css", ".css")),
        ("Client scripts", folder("public/js", ".js")),
    ]

    result = [(name, [p for p in paths if keep(p)]) for name, paths in sections]
    result = [(name, paths) for name, paths in result if paths]
    appendix = [p for p in parts["appendix"] if os.path.isfile(p)]

    return result, appendix


def status_of(path, parts):
    """New or Changed in Part 3, and any note, for the file's heading."""
    if path in parts["changed"]:
        return "Changed in Part 3", parts["changed"][path]
    return "New in Part 3", ""


# ----------------------------------------------------------------------
# Reading and colouring the code
# ----------------------------------------------------------------------

def read_source(path):
    with open(path, encoding="utf-8") as handle:
        return handle.read().replace("\t", "    ").rstrip("\n")


def style_for(token_type):
    """Maps a pygments token type to one of the STYLES keys."""
    if token_type in Token.Comment:
        return "comment"
    if token_type in Token.Name.Tag:
        return "tag"
    if token_type in Token.Name.Attribute:
        return "attribute"
    if token_type in Token.Literal.String:
        return "string"
    if token_type in Token.Literal.Number:
        return "number"
    if token_type in Token.Keyword or token_type in Token.Name.Builtin or token_type in Token.Operator.Word:
        return "keyword"
    if token_type in Token.Name.Function or token_type in Token.Name.Class:
        return "function"
    return "ink"


def coloured_lines(path, source):
    """The file as a list of lines, each a list of (text, style) pieces."""
    lines = [[] for _ in source.split("\n")]

    if not COLOURING:
        return [[(text, "ink")] for text in source.split("\n")]

    if path.endswith(".html"):
        lexer = HtmlLexer()
    elif path.endswith(".css"):
        lexer = CssLexer()
    else:
        lexer = JavascriptLexer()

    row = 0
    for token_type, value in lex(source, lexer):
        style = style_for(token_type)
        pieces = value.split("\n")
        for index, piece in enumerate(pieces):
            if index > 0:
                row += 1
            if piece and row < len(lines):
                lines[row].append((piece, style))

    return lines


def wrap(pieces, number):
    """Breaks one source line into rows that fit the panel. Only the first
    row carries the line number, so the numbering matches the file. A
    continuation is indented two spaces past the line's own indent."""
    text = "".join(t for t, _ in pieces)
    styles = []
    for t, s in pieces:
        styles.extend([s] * len(t))

    if len(text) <= CODE_CHARS:
        return [(number, pieces)]

    indent = len(text) - len(text.lstrip())
    hanging = min(indent + 2, 40)
    rows = []
    start = 0
    first = True

    while start < len(text):
        room = CODE_CHARS - (0 if first else hanging)
        end = min(len(text), start + room)

        if end < len(text):
            cut = text.rfind(" ", start, end + 1)
            if cut > start + room * 0.4:
                end = cut

        row = [] if first else [(" " * hanging, "ink")]
        i = start
        while i < end:
            j = i
            while j < end and styles[j] == styles[i]:
                j += 1
            row.append((text[i:j], styles[i]))
            i = j

        rows.append((number if first else None, row))
        start = end
        while start < len(text) and text[start] == " ":
            start += 1
        first = False

    return rows


# ----------------------------------------------------------------------
# The code panel
# ----------------------------------------------------------------------

ANCHOR_PAGES = {}


class CodeBlock(Flowable):
    """A run of code rows on the grey panel, with the number strip. It
    splits across pages by itself, so a long file flows on page after
    page, each piece with its own panel."""

    def __init__(self, rows, anchors, top=True, bottom=True):
        Flowable.__init__(self)
        self.rows = rows            # (number or None, pieces)
        self.anchors = anchors      # line number -> bookmark key
        self.top = top
        self.bottom = bottom

    def _height(self, count):
        return count * LEADING + (BLOCK_PAD if self.top else 2) + (BLOCK_PAD if self.bottom else 2)

    def wrap(self, available_width, available_height):
        self.width = available_width
        self.height = self._height(len(self.rows))
        return self.width, self.height

    def split(self, available_width, available_height):
        fits = int((available_height - (BLOCK_PAD if self.top else 2) - 2) / LEADING)

        if fits >= len(self.rows):
            return [self]
        if fits < 4:
            return []

        return [CodeBlock(self.rows[:fits], self.anchors, self.top, False),
                CodeBlock(self.rows[fits:], self.anchors, False, self.bottom)]

    def draw(self):
        canvas = self.canv
        canvas.saveState()

        canvas.setFillColor(PANEL)
        canvas.rect(0, 0, self.width, self.height, stroke=0, fill=1)
        canvas.setFillColor(STRIP)
        canvas.rect(0, 0, GUTTER, self.height, stroke=0, fill=1)

        y = self.height - (BLOCK_PAD if self.top else 2) - LEADING + 2.2

        for number, pieces in self.rows:
            if number is not None:
                canvas.setFont("Courier", FONT_SIZE - 0.5)
                canvas.setFillColor(NUMBER)
                canvas.drawRightString(GUTTER - 4, y, str(number))

                key = self.anchors.get(number)
                if key:
                    canvas.bookmarkHorizontal(key, 0, y + LEADING)
                    ANCHOR_PAGES[key] = canvas.getPageNumber()

            x = GUTTER + CODE_PAD
            for text, style in pieces:
                font, colour = STYLES.get(style, INK)
                canvas.setFont(font, FONT_SIZE)
                canvas.setFillColor(colour)
                canvas.drawString(x, y, text)
                x += len(text) * CHAR_WIDTH

            y -= LEADING

        canvas.restoreState()


# ----------------------------------------------------------------------
# The document
# ----------------------------------------------------------------------

def on_page(canvas, doc):
    # Drawn when the page is finished rather than when it starts, so the
    # running header names what is actually on the page.
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#666666"))
    top = PAGE_HEIGHT - MARGIN + 5 * mm
    canvas.drawString(MARGIN, top, "%s  |  %s" % (TITLE, SUBTITLE))
    canvas.drawRightString(PAGE_WIDTH - MARGIN, top, doc.current_file)
    canvas.setStrokeColor(colors.HexColor("#cccccc"))
    canvas.line(MARGIN, top - 1.5 * mm, PAGE_WIDTH - MARGIN, top - 1.5 * mm)
    canvas.drawCentredString(PAGE_WIDTH / 2, MARGIN - 7 * mm, str(canvas.getPageNumber()))
    canvas.restoreState()


class Listing(BaseDocTemplate):
    """Adds the bookmarks and contents entries as headings are placed, and
    keeps the running header naming the file on each page."""

    def __init__(self, filename, **kw):
        BaseDocTemplate.__init__(self, filename, **kw)
        self.current_file = ""
        frame = Frame(MARGIN, MARGIN, CONTENT_WIDTH, PAGE_HEIGHT - 2 * MARGIN, id="body",
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate(id="page", frames=[frame], onPageEnd=on_page)])

    def handle_documentBegin(self):
        self.current_file = ""
        BaseDocTemplate.handle_documentBegin(self)

    def afterFlowable(self, flowable):
        mark = getattr(flowable, "_mark", None)
        if mark is None:
            return

        key, title, level, label = mark
        self.canv.bookmarkHorizontal(key, 0, self.frame._y + flowable.height + 4)
        self.canv.addOutlineEntry(title, key, level=level, closed=level == 0)
        if label:
            self.notify("TOCEntry", (level, label, self.page, key))

        if level == 1:
            self.current_file = title
        elif level == 0:
            self.current_file = ""


def marked(paragraph, key, title, level, label):
    paragraph._mark = (key, title, level, label)
    return paragraph


def build_story(parts, sections, appendix, anchors_by_file, file_count, total_lines):
    title_style = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=22, leading=27)
    sub_style = ParagraphStyle("sub", fontName="Helvetica", fontSize=11.5, leading=16,
                               textColor=colors.HexColor("#444444"))
    heading_style = ParagraphStyle("heading", fontName="Helvetica-Bold", fontSize=15, leading=19,
                                   textColor=GREEN, spaceAfter=6)
    section_style = ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=13, leading=17,
                                   textColor=GREEN, spaceAfter=4)
    file_style = ParagraphStyle("file", fontName="Courier-Bold", fontSize=11, leading=14,
                                spaceBefore=4)
    about_style = ParagraphStyle("about", fontName="Helvetica", fontSize=8.8, leading=12,
                                 textColor=GREY_TEXT, spaceAfter=4)
    body_style = ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13.5,
                                spaceAfter=5)
    cell_style = ParagraphStyle("cell", fontName="Helvetica", fontSize=8.8, leading=11.5)
    cell_bold = ParagraphStyle("cellbold", parent=cell_style, fontName="Helvetica-Bold")

    story = []

    # ---- title page
    story.append(Spacer(1, 50 * mm))
    story.append(Paragraph(TITLE, title_style))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(SUBTITLE, sub_style))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(AUTHOR, sub_style))
    story.append(Paragraph("%d files, %s lines. Generated %s."
                           % (file_count, format(total_lines, ","),
                              date.today().strftime("%d %B %Y")), sub_style))
    story.append(Spacer(1, 12 * mm))
    story.append(Paragraph("Reading this document", section_style))
    for line in [
        "<b>Where to find it</b>, on the next page, links each improvement to the file and "
        "line that does it. <b>Contents</b> follows, with every file and its page.",
        "Every entry in both is a link. The viewer's bookmarks sidebar lists every file too.",
        "Each file is marked <b>New in Part 3</b> or <b>Changed in Part 3</b>. Pages that Part 3 "
        "did not change are named at the end but not printed.",
        "Line numbers are the file's own. A line too long for the page continues on the next "
        "row, indented, with no number of its own, so the numbers always match the file.",
    ]:
        story.append(Paragraph(line, body_style))
    story.append(PageBreak())

    # ---- where to find it
    story.append(marked(Paragraph("Where to find it", heading_style),
                        "where", "Where to find it", 0, "Where to find it"))
    story.append(Paragraph(
        "The improvements made in Part 3, and where each is done in the code. Select a location "
        "to go straight to that line.", body_style))

    rows = [[Paragraph("Improvement", cell_bold), Paragraph("Where to look", cell_bold),
             Paragraph("Page", cell_bold)]]
    styles = [("LINEBELOW", (0, 0), (-1, 0), 0.8, GREEN),
              ("VALIGN", (0, 0), (-1, -1), "TOP"),
              ("TOPPADDING", (0, 0), (-1, -1), 3.5),
              ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5)]

    for entry in parts["map"]:
        if entry[0] == "group":
            rows.append([Paragraph(entry[1], ParagraphStyle(
                "group", parent=cell_bold, textColor=GREEN, fontSize=9.5)), "", ""])
            styles.append(("SPAN", (0, len(rows) - 1), (-1, len(rows) - 1)))
            styles.append(("TOPPADDING", (0, len(rows) - 1), (-1, len(rows) - 1), 9))
            styles.append(("LINEBELOW", (0, len(rows) - 1), (-1, len(rows) - 1), 0.4,
                           colors.HexColor("#BBBBBB")))
            continue

        _, name, places = entry
        where, pages = [], []
        for path, anchor in places:
            number, key = anchors_by_file.get(path, {}).get(anchor, (None, None))
            if number is None:
                where.append("<font color='#B00020'>%s: not found</font>" % path)
                pages.append("")
                continue
            where.append("<a href='#%s' color='#1F4A32'><u>%s</u>, line %d</a>" % (key, path, number))
            pages.append("<a href='#%s' color='#1F4A32'>%s</a>" % (key, ANCHOR_PAGES.get(key, "")))
        rows.append([Paragraph(name, cell_style),
                     Paragraph("<br/>".join(where), cell_style),
                     Paragraph("<br/>".join(str(p) for p in pages), cell_style)])
        styles.append(("LINEBELOW", (0, len(rows) - 1), (-1, len(rows) - 1), 0.25,
                       colors.HexColor("#DDDDDD")))

    table = Table(rows, colWidths=[62 * mm, CONTENT_WIDTH - 62 * mm - 14 * mm, 14 * mm],
                  repeatRows=1)
    table.setStyle(TableStyle(styles))
    story.append(table)
    story.append(PageBreak())

    # ---- contents
    story.append(marked(Paragraph("Contents", heading_style), "contents", "Contents", 0, None))
    toc = TableOfContents(dotsMinLevel=1)
    toc.levelStyles = [
        ParagraphStyle("toc0", fontName="Helvetica-Bold", fontSize=10, leading=15,
                       spaceBefore=6, textColor=GREEN),
        ParagraphStyle("toc1", fontName="Helvetica", fontSize=9, leading=12.5, leftIndent=12),
    ]
    story.append(toc)
    story.append(PageBreak())

    # ---- the files
    def file_block(path, number):
        status, note = status_of(path, parts)
        about = parts["describe"].get(path, "")
        source = read_source(path)
        lines = coloured_lines(path, source)
        anchors = {n: key for anchor, (n, key) in anchors_by_file.get(path, {}).items() if n}

        rows = []
        for n, pieces in enumerate(lines, start=1):
            rows.extend(wrap(pieces, n))

        colour = "#1F4A32" if status.startswith("New") else "#8A5A00"
        label = ("%s &nbsp;<font size='7.5' color='%s'>%s</font>"
                 " &nbsp;<font size='7.5' color='#888888'>%s lines</font>"
                 % (path, colour, status, format(len(lines), ",")))
        heading = marked(Paragraph(path, file_style), "file-%d" % number, path, 1, label)
        details = "<font color='%s'><b>%s</b></font>" % (colour, status)
        if note:
            details += " (%s)" % note
        details += ". %s lines." % format(len(lines), ",")
        if about:
            details = about + ". " + details

        # The heading is kept with the file's first few rows, so a page
        # break never leaves a heading alone at the foot of a page.
        opening = CodeBlock(rows[:8], anchors, True, len(rows) <= 8)
        items = [KeepTogether([heading, Paragraph(details, about_style), opening])]
        if len(rows) > 8:
            items.append(CodeBlock(rows[8:], anchors, False, True))
        items.append(Spacer(1, 7 * mm))
        return items

    counter = 0
    for index, (section, paths) in enumerate(sections):
        story.append(marked(Paragraph(section, heading_style), "section-%d" % index, section, 0, section))
        for path in paths:
            counter += 1
            story.extend(file_block(path, counter))
        story.append(PageBreak())

    # ---- not printed, and the appendix
    story.append(marked(Paragraph("Pages not changed in Part 3", heading_style),
                        "unchanged", "Pages not changed in Part 3", 0, "Pages not changed in Part 3"))
    story.append(Paragraph(
        "The task asks for the code of the improved pages. These files are exactly as they were "
        "at the end of Part 2, so they are not printed here:", body_style))
    for path in parts["unchanged"]:
        story.append(Paragraph("<font face='Courier'>%s</font>" % path, body_style))

    if appendix:
        story.append(PageBreak())
        story.append(marked(Paragraph("Appendix", heading_style), "appendix", "Appendix", 0, "Appendix"))
        story.append(Paragraph(
            "Printed last because it is mostly data rather than code: the content the empty "
            "database is filled with.", body_style))
        for path in appendix:
            counter += 1
            story.extend(file_block(path, counter))

    return story


def find_anchors(parts):
    """Finds the line for every "Where to find it" entry, by searching the
    file for its text. Spaces are compared loosely, so aligned columns in
    the source do not have to be copied exactly."""
    found = {}
    counter = 0

    for entry in parts["map"]:
        if entry[0] != "item":
            continue
        for path, anchor in entry[2]:
            if not os.path.isfile(path):
                continue
            wanted = " ".join(anchor.split())
            number = None
            for n, text in enumerate(read_source(path).split("\n"), start=1):
                if wanted in " ".join(text.split()):
                    number = n
                    break
            counter += 1
            found.setdefault(path, {})[anchor] = (number, "line-%d" % counter)

    return found


def build(output):
    parts = read_manifest()
    sections, appendix = listed_files(parts)
    every = [p for _, paths in sections for p in paths] + appendix
    total_lines = sum(len(read_source(p).split("\n")) for p in every)
    anchors = find_anchors(parts)

    # Built twice: the first pass finds the page each "Where to find it"
    # line lands on, and the second prints those page numbers.
    for _ in range(2):
        doc = Listing(output, pagesize=A4, title="%s, %s" % (TITLE, SUBTITLE), author=AUTHOR,
                      topMargin=MARGIN, bottomMargin=MARGIN)
        doc.multiBuild(build_story(parts, sections, appendix, anchors, len(every), total_lines))

    missing = [(path, anchor) for path, found in anchors.items()
               for anchor, (n, _) in found.items() if n is None]
    return len(every), total_lines, missing


if __name__ == "__main__":
    if not os.path.isfile("server.js"):
        sys.exit("Run this from the project root, where server.js is.")

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    output = args[0] if args else "code-listing.pdf"
    count, lines, missing = build(output)

    print("Wrote %s: %d files, %s lines." % (output, count, format(lines, ",")))
    if not COLOURING:
        print("pygments is not installed, so the code is in one colour. pip install pygments")
    for path, anchor in missing:
        print("Where to find it: could not find \"%s\" in %s" % (anchor, path))
