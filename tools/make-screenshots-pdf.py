#!/usr/bin/env python3
"""
Builds the screenshots PDF that Task 10.2D asks for, from a folder of
screenshots and the captions in tools/screenshots.txt.

Run from the project root:

    python tools/make-screenshots-pdf.py "path/to/10.2 screenshots"

It writes screenshots.pdf beside the project, or to a second argument
if one is given. The order, the section headings and every caption come
from the manifest, so changing the PDF means editing screenshots.txt,
not this file.

Needs Python with reportlab and Pillow:  pip install reportlab pillow
"""

import os
import sys
from datetime import date

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer,
)
from reportlab.platypus.tableofcontents import TableOfContents

TITLE = "Oceania Adventure Guild"
SUBTITLE = "Screenshots, SIT774 Task 10.2D"
AUTHOR = "Hassan Mohamed, student ID 226283244"

IMAGE_TYPES = (".jpg", ".jpeg", ".png")
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots.txt")

PAGE_W, PAGE_H = landscape(A4)
MARGIN = 12 * mm
BODY_W = PAGE_W - 2 * MARGIN
BODY_H = PAGE_H - 2 * MARGIN - 8 * mm

# A browser screenshot is drawn as large as the page allows while still
# leaving room for its caption on the same page.
MAX_IMAGE_H = BODY_H - 24 * mm

GREEN = colors.HexColor("#1F4A32")
GREY = colors.HexColor("#555555")


# ----------------------------------------------------------------------
# Reading the manifest
# ----------------------------------------------------------------------

def stem(name):
    """A file name without its image extension, lower case, so a manifest
    line matches its file whatever the case of the extension. Only a real
    image extension is removed: "step 6.2 admin" must stay whole, and not
    be read as a file called "step 6" with the extension ".2 admin"."""
    name = name.strip()
    base, ext = os.path.splitext(name)
    return (base if ext.lower() in IMAGE_TYPES else name).strip().lower()


def read_manifest(path):
    """Returns (sections, omitted). Each section is a dict with a heading,
    its introduction lines and its (file stem, caption) entries."""
    sections, omitted = [], set()
    current = None

    with open(path, encoding="utf-8") as handle:
        for raw in handle:
            line = raw.rstrip("\n")
            text = line.strip()

            if not text:
                continue
            if text.startswith("!omit "):
                omitted.add(stem(text[6:]))
                continue
            if text.startswith("#") and not text.startswith("##"):
                continue
            if text.startswith("## "):
                current = {"heading": text[3:].strip(), "intro": [], "entries": []}
                sections.append(current)
                continue
            if text.startswith("> ") and current is not None:
                current["intro"].append(text[2:].strip())
                continue
            if "|" in text and current is not None:
                name, caption = text.split("|", 1)
                current["entries"].append((stem(name), caption.strip()))

    return sections, omitted


# ----------------------------------------------------------------------
# The document
# ----------------------------------------------------------------------

def on_page(canvas, doc):
    # Drawn when the page is finished rather than when it starts, so the
    # running header names what is actually on the page.
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#666666"))
    top = PAGE_H - MARGIN + 2 * mm
    canvas.drawString(MARGIN, top, "%s  |  %s" % (TITLE, SUBTITLE))
    canvas.drawRightString(PAGE_W - MARGIN, top, getattr(doc, "section", ""))
    canvas.setStrokeColor(colors.HexColor("#cccccc"))
    canvas.line(MARGIN, top - 2 * mm, PAGE_W - MARGIN, top - 2 * mm)
    canvas.drawCentredString(PAGE_W / 2, MARGIN - 6 * mm, str(canvas.getPageNumber()))
    canvas.restoreState()


class ScreenshotDoc(BaseDocTemplate):
    """Carries the current section name into the running header, and adds
    a bookmark and a contents entry for every section and figure as it is
    placed, so the contents page and the viewer's sidebar both link
    straight to it."""

    def __init__(self, filename, **kw):
        BaseDocTemplate.__init__(self, filename, **kw)
        self.section = ""
        frame = Frame(MARGIN, MARGIN, BODY_W, BODY_H, id="body",
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate(id="page", frames=[frame], onPageEnd=on_page)])

    def handle_documentBegin(self):
        self.section = ""
        BaseDocTemplate.handle_documentBegin(self)

    def afterFlowable(self, flowable):
        name = getattr(flowable, "_section", None)
        if name is not None:
            self.section = name

        mark = getattr(flowable, "_mark", None)
        if mark is not None:
            key, title, level = mark
            # The frame's position after the flowable, plus its height, is
            # its top edge, which is where a link to it should land.
            height = getattr(flowable, "drawHeight", None) or flowable.wrap(BODY_W, BODY_H)[1]
            self.canv.bookmarkHorizontal(key, 0, self.frame._y + height + 6)
            self.canv.addOutlineEntry(title, key, level=level, closed=level == 0)
            if key != "contents":
                self.notify("TOCEntry", (level, title, self.page, key))


def short(caption, limit=80):
    """The first sentence of a caption, cut to fit one contents line."""
    first = caption.split(". ")[0].split(": ")[0].rstrip(".")
    if len(first) <= limit:
        return first
    return first[:first.rfind(" ", 0, limit)].rstrip(",;") + "\u2026"


# Screenshots are taken at 2560 pixels wide, far more than a printed page
# needs. Each is reduced to at most this width and recompressed before it
# is placed, which keeps the PDF a size OnTrack will accept without any
# visible loss at the size it is printed.
MAX_PIXELS_WIDE = 1440
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".screenshot-cache")


def reduced(path):
    """Returns the path of a smaller copy of the image, made once."""
    os.makedirs(CACHE, exist_ok=True)
    target = os.path.join(CACHE, stem(os.path.basename(path)) + ".jpg")

    if os.path.exists(target) and os.path.getmtime(target) >= os.path.getmtime(path):
        return target

    with PILImage.open(path) as im:
        im = im.convert("RGB")
        if im.width > MAX_PIXELS_WIDE:
            im = im.resize((MAX_PIXELS_WIDE, round(im.height * MAX_PIXELS_WIDE / im.width)),
                           PILImage.LANCZOS)
        im.save(target, "JPEG", quality=76, optimize=True)

    return target


def scaled_image(path):
    """An Image flowable scaled to fit the page width and the height limit,
    never enlarged beyond its own pixels at 150 dpi so small crops stay
    sharp rather than blown up."""
    with PILImage.open(path) as im:
        px_w, px_h = im.size

    natural_w = px_w / 150.0 * 25.4 * mm
    width = min(BODY_W, natural_w * 1.6)
    height = width * px_h / px_w

    if height > MAX_IMAGE_H:
        height = MAX_IMAGE_H
        width = height * px_w / px_h

    image = Image(reduced(path), width=width, height=height)
    image.hAlign = "CENTER"
    return image


def build(folder, output):
    heading_style = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=15, leading=19,
                                   textColor=GREEN, spaceAfter=3)
    intro_style = ParagraphStyle("i", fontName="Helvetica", fontSize=9.5, leading=13,
                                 textColor=GREY, spaceAfter=6)
    caption_style = ParagraphStyle("c", fontName="Helvetica", fontSize=9, leading=12,
                                   spaceBefore=3, spaceAfter=9, alignment=TA_LEFT)
    title_style = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=24, leading=30)
    sub_style = ParagraphStyle("s", fontName="Helvetica", fontSize=12, leading=17,
                               textColor=colors.HexColor("#444444"))
    toc_style = ParagraphStyle("toc", fontName="Helvetica", fontSize=10.5, leading=16)

    on_disk = {}
    for name in os.listdir(folder):
        if name.lower().endswith(IMAGE_TYPES):
            on_disk[stem(name)] = os.path.join(folder, name)

    sections, omitted = read_manifest(MANIFEST)
    placed, missing = set(), []

    # Resolve every entry first, so the contents page lists only sections
    # that actually have a screenshot in them.
    resolved = []
    for section in sections:
        entries = []
        for key, caption in section["entries"]:
            if key in on_disk:
                entries.append((on_disk[key], caption))
                placed.add(key)
            else:
                missing.append((section["heading"], key))
        if entries:
            resolved.append((section, entries))

    unplaced = sorted(k for k in on_disk if k not in placed and k not in omitted)
    if unplaced:
        resolved.append(({"heading": "Not yet placed", "intro": [
            "Screenshots found in the folder that the manifest does not list yet."]},
            [(on_disk[k], k) for k in unplaced]))

    story = []
    count = sum(len(entries) for _, entries in resolved)

    # Title page and contents.
    story.append(Spacer(1, 30 * mm))
    story.append(Paragraph(TITLE, title_style))
    story.append(Paragraph(SUBTITLE, sub_style))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(AUTHOR, sub_style))
    story.append(Paragraph("%d screenshots. Generated %s." % (count, date.today().strftime("%d %B %Y")), sub_style))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "Every browser screenshot was taken in Chrome against the local server, with "
        "http://localhost:3000 visible in the address bar. Database contents before and "
        "after each change are shown with <font face='Courier'>node display.js</font> "
        "in the terminal.", intro_style))
    story.append(Paragraph(
        "Every entry in the contents is a link, and the viewer's bookmarks sidebar lists "
        "every section and figure too.", intro_style))
    story.append(PageBreak())

    contents = Paragraph("Contents", heading_style)
    contents._mark = ("contents", "Contents", 0)
    story.append(contents)
    toc = TableOfContents(dotsMinLevel=1)
    toc.levelStyles = [
        ParagraphStyle("toc0", fontName="Helvetica-Bold", fontSize=10.5, leading=15,
                       spaceBefore=7, textColor=GREEN),
        ParagraphStyle("toc1", fontName="Helvetica", fontSize=8.8, leading=11.5, leftIndent=14),
    ]
    story.append(toc)
    story.append(PageBreak())

    figure = 0
    for number, (section, entries) in enumerate(resolved, start=1):
        heading = Paragraph(section["heading"], heading_style)
        heading._section = section["heading"]
        heading._mark = ("section-%d" % number, section["heading"], 0)
        opening = [heading] + [Paragraph(line, intro_style) for line in section["intro"]]

        for index, (path, caption) in enumerate(entries):
            figure += 1
            image = scaled_image(path)
            image._mark = ("figure-%d" % figure, "Figure %d. %s" % (figure, short(caption)), 1)
            block = [image,
                     Paragraph("<b>Figure %d.</b> %s" % (figure, caption), caption_style)]

            # Keep a section's heading on the same page as its first
            # screenshot, rather than stranded at the foot of a page.
            story.append(KeepTogether(opening + block if index == 0 else block))

        story.append(PageBreak())

    doc = ScreenshotDoc(output, pagesize=landscape(A4),
                        title="%s, %s" % (TITLE, SUBTITLE), author=AUTHOR)
    doc.multiBuild(story)
    return count, missing, unplaced


if __name__ == "__main__":
    if len(sys.argv) < 2 or not os.path.isdir(sys.argv[1]):
        sys.exit('Usage: python tools/make-screenshots-pdf.py "path/to/screenshots folder" [output.pdf]')

    output = sys.argv[2] if len(sys.argv) > 2 else "screenshots.pdf"
    count, missing, unplaced = build(sys.argv[1], output)

    print("Wrote %s: %d screenshots." % (output, count))
    if missing:
        print("\nListed in the manifest but not in the folder (%d):" % len(missing))
        for heading, key in missing:
            print("  [%s]  %s" % (heading, key))
    if unplaced:
        print("\nIn the folder but not in the manifest, put under 'Not yet placed' (%d):" % len(unplaced))
        for key in unplaced:
            print("  " + key)
