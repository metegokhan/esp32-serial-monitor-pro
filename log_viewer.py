import re
from typing import Optional, List, Set, Tuple
from PyQt6.QtWidgets import (
    QPlainTextEdit, QTextEdit, QWidget, QMenu, QApplication
)
from PyQt6.QtGui import (
    QPainter, QColor, QTextFormat, QTextCursor, QFont,
    QMouseEvent, QPaintEvent, QResizeEvent, QPen, QBrush
)
from PyQt6.QtCore import Qt, QRect, QSize, pyqtSignal, QPoint

from syntax_highlighter import Esp32SyntaxHighlighter


class LineNumberArea(QWidget):
    def __init__(self, editor: 'Esp32LogViewer'):
        super().__init__(editor)
        self.editor = editor
        self.setMouseTracking(True)
        self.hovered_line: Optional[int] = None

    def sizeHint(self) -> QSize:
        return QSize(self.editor.lineNumberAreaWidth(), 0)

    def paintEvent(self, event: QPaintEvent):
        self.editor.lineNumberAreaPaintEvent(event)

    def mousePressEvent(self, event: QMouseEvent):
        self.editor.lineNumberAreaMousePress(event)

    def mouseMoveEvent(self, event: QMouseEvent):
        line = self.editor.getLineAtY(event.position().y())
        if line != self.hovered_line:
            self.hovered_line = line
            self.update()

    def leaveEvent(self, event):
        self.hovered_line = None
        self.update()


class Esp32LogViewer(QPlainTextEdit):
    # Sinyaller
    range_selected = pyqtSignal(int, int, str)  # start_line, end_line, text
    range_cleared = pyqtSignal()
    word_clicked = pyqtSignal(str, int, int)     # word, occurrences_count, line_count
    status_message = pyqtSignal(str)
    filter_stats_updated = pyqtSignal(int, int) # matched_lines, total_lines

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setReadOnly(True)
        self.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)

        # Yazı tipi ve renkler
        font = QFont("Monospace", 10)
        font.setStyleHint(QFont.StyleHint.Monospace)
        self.setFont(font)

        # Monokai / Modern Dark Tema Stili
        self.setStyleSheet("""
            QPlainTextEdit {
                background-color: #1E1E2E;
                color: #CDD6F4;
                selection-background-color: #45475A;
                selection-color: #F5E0DC;
                border: 1px solid #313244;
                border-radius: 4px;
                padding: 4px;
            }
        """)

        # Satır alanı (Gutter) bileşeni
        self.line_number_area = LineNumberArea(self)

        # Syntax Highlighter
        self.highlighter = Esp32SyntaxHighlighter(self.document())

        # Ham Satır Tamponu (Filtreleme için kaynak)
        self.raw_lines: List[str] = []
        self.filter_only_matching: bool = False
        self.filter_pattern: Optional[re.Pattern] = None

        # Seçim Noktaları (Gutter Click Points)
        self.point_a: Optional[int] = None  # 1-indexed satır numarası
        self.point_b: Optional[int] = None

        # Tıklanan kelime ve satır vurguları
        self.clicked_word: str = ""
        self.clicked_word_lines: Set[int] = set()

        # Olay bağlantıları
        self.blockCountChanged.connect(self.updateLineNumberAreaWidth)
        self.updateRequest.connect(self.updateLineNumberArea)
        self.cursorPositionChanged.connect(self.highlightCurrentLineAndSelections)

        self.updateLineNumberAreaWidth(0)

        # Performans için maksimum tampon limiti
        self.max_lines = 30000

    def setMaxLines(self, max_lines: int):
        self.max_lines = max_lines

    def appendLogLine(self, line: str, auto_scroll: bool = True):
        # 1. Ham tampona ekle
        self.raw_lines.append(line)
        if len(self.raw_lines) > self.max_lines:
            self.raw_lines = self.raw_lines[-self.max_lines:]

        # 2. Eğer "Sadece Eşleşenleri Göster" filtresi aktifse ve satır uymuyorsa arayüze basma
        if self.filter_only_matching and self.filter_pattern:
            if not self.filter_pattern.search(line):
                # Filtre istatistiğini bildir
                return

        # 3. Belgeye ekle
        doc = self.document()
        if doc.blockCount() > self.max_lines:
            cursor = QTextCursor(doc)
            cursor.movePosition(QTextCursor.MoveOperation.Start)
            for _ in range(1500):
                cursor.movePosition(QTextCursor.MoveOperation.Down, QTextCursor.MoveMode.KeepAnchor)
            cursor.movePosition(QTextCursor.MoveOperation.EndOfLine, QTextCursor.MoveMode.KeepAnchor)
            cursor.movePosition(QTextCursor.MoveOperation.Right, QTextCursor.MoveMode.KeepAnchor)
            cursor.removeSelectedText()

            if self.point_a is not None:
                self.point_a = max(1, self.point_a - 1500)
            if self.point_b is not None:
                self.point_b = max(1, self.point_b - 1500)

        cursor = self.textCursor()
        cursor.movePosition(QTextCursor.MoveOperation.End)
        if doc.characterCount() > 1 and not doc.toPlainText().endswith("\n"):
            cursor.insertText("\n" + line)
        else:
            cursor.insertText(line + "\n")

        if auto_scroll:
            self.verticalScrollBar().setValue(self.verticalScrollBar().maximum())

    def load_text(self, text: str):
        """Dışarıdan bir metin veya dosya içeriğini tam olarak yükler."""
        self.clearPoints()
        self.clearWordHighlight()
        self.raw_lines = text.splitlines()
        self._refresh_display_content()

    def clear_all(self):
        """Tüm ham ve ekrandaki verileri sıfırlar."""
        self.raw_lines.clear()
        self.clear()
        self.clearPoints()
        self.clearWordHighlight()
        self.filter_stats_updated.emit(0, 0)

    def get_full_raw_text(self) -> str:
        """Filtreli olsun veya olmasın tüm orijinal veriyi döndürür."""
        return "\n".join(self.raw_lines)

    # --- Eşzamanlı Satır Filtreleme (Sadece İçeren Satırları Gösterme) ---

    def set_filter_mode(self, query: str, is_regex: bool = False, case_sensitive: bool = False, only_matching: bool = False) -> Tuple[int, int]:
        """
        query: Aranacak metin
        only_matching: True ise SADECE eşleşen satırları gösterir (Grep Görünümü)
        """
        query = query.strip()
        self.filter_only_matching = only_matching and bool(query)

        if query:
            try:
                flags = 0 if case_sensitive else re.IGNORECASE
                pattern = query if is_regex else re.escape(query)
                self.filter_pattern = re.compile(pattern, flags)
            except re.error:
                self.filter_pattern = None
        else:
            self.filter_pattern = None

        # Renklendiricideki arama vurgusunu güncelle
        self.highlighter.set_search_query(query, is_regex, case_sensitive)

        # Görünümü yeniden oluştur
        return self._refresh_display_content()

    def _refresh_display_content(self) -> Tuple[int, int]:
        total_count = len(self.raw_lines)

        if self.filter_only_matching and self.filter_pattern:
            matched = [line for line in self.raw_lines if self.filter_pattern.search(line)]
            display_str = "\n".join(matched) + ("\n" if matched else "")
            self.setPlainText(display_str)
            matched_count = len(matched)
        else:
            display_str = "\n".join(self.raw_lines) + ("\n" if self.raw_lines else "")
            self.setPlainText(display_str)
            matched_count = total_count

        self.filter_stats_updated.emit(matched_count, total_count)
        self.line_number_area.update()
        return matched_count, total_count

    # --- Satır Numarası ve Nokta Seçim Alanı (Gutter) ---

    def lineNumberAreaWidth(self) -> int:
        digits = max(1, len(str(max(1, self.blockCount()))))
        space = 3 + self.fontMetrics().horizontalAdvance('9') * digits
        dot_area = 24  # Tıklama noktası için ayrılan alan
        return space + dot_area + 10

    def updateLineNumberAreaWidth(self, _):
        self.setViewportMargins(self.lineNumberAreaWidth(), 0, 0, 0)

    def updateLineNumberArea(self, rect: QRect, dy: int):
        if dy:
            self.line_number_area.scroll(0, dy)
        else:
            self.line_number_area.update(0, rect.y(), self.line_number_area.width(), rect.height())

        if rect.contains(self.viewport().rect()):
            self.updateLineNumberAreaWidth(0)

    def resizeEvent(self, event: QResizeEvent):
        super().resizeEvent(event)
        cr = self.contentsRect()
        self.line_number_area.setGeometry(
            QRect(cr.left(), cr.top(), self.lineNumberAreaWidth(), cr.height())
        )

    def getLineAtY(self, y: float) -> Optional[int]:
        cursor = self.cursorForPosition(QPoint(0, int(y)))
        block = cursor.block()
        if block.isValid():
            return block.blockNumber() + 1
        return None

    def lineNumberAreaPaintEvent(self, event: QPaintEvent):
        painter = QPainter(self.line_number_area)
        painter.fillRect(event.rect(), QColor("#181825"))  # Koyu sol kenar

        block = self.firstVisibleBlock()
        block_number = block.blockNumber()
        top = int(self.blockBoundingGeometry(block).translated(self.contentOffset()).top())
        bottom = top + int(self.blockBoundingRect(block).height())

        font_metrics = self.fontMetrics()
        area_width = self.line_number_area.width()
        dot_area_width = 24
        line_num_right = area_width - dot_area_width - 8

        # Nokta aralığı sınırları
        min_p = min(self.point_a, self.point_b) if (self.point_a and self.point_b) else None
        max_p = max(self.point_a, self.point_b) if (self.point_a and self.point_b) else None

        while block.isValid() and top <= event.rect().bottom():
            if block.isVisible() and bottom >= event.rect().top():
                line_num = block_number + 1

                # 1. Satır Numarasını Çiz
                num_str = str(line_num)
                if line_num == self.point_a or line_num == self.point_b:
                    painter.setPen(QColor("#F9E2AF"))  # Sarı vurgulu satır no
                elif min_p and max_p and min_p < line_num < max_p:
                    painter.setPen(QColor("#89B4FA"))  # Açık mavi
                else:
                    painter.setPen(QColor("#585B70"))  # Normal soluk gri
                painter.drawText(0, top, line_num_right, font_metrics.height(), Qt.AlignmentFlag.AlignRight, num_str)

                # 2. Tıklama Noktası / Rozetini Çiz
                dot_center_x = area_width - 12
                dot_center_y = top + font_metrics.height() // 2

                if line_num == self.point_a:
                    painter.setBrush(QBrush(QColor("#A6E3A1")))
                    painter.setPen(Qt.PenStyle.NoPen)
                    painter.drawEllipse(dot_center_x - 7, dot_center_y - 7, 14, 14)
                    painter.setPen(QColor("#11111B"))
                    painter.setFont(QFont("SansSerif", 7, QFont.Weight.Bold))
                    painter.drawText(dot_center_x - 7, dot_center_y - 7, 14, 14, Qt.AlignmentFlag.AlignCenter, "A")
                    painter.setFont(self.font())
                elif line_num == self.point_b:
                    painter.setBrush(QBrush(QColor("#F38BA8")))
                    painter.setPen(Qt.PenStyle.NoPen)
                    painter.drawEllipse(dot_center_x - 7, dot_center_y - 7, 14, 14)
                    painter.setPen(QColor("#11111B"))
                    painter.setFont(QFont("SansSerif", 7, QFont.Weight.Bold))
                    painter.drawText(dot_center_x - 7, dot_center_y - 7, 14, 14, Qt.AlignmentFlag.AlignCenter, "B")
                    painter.setFont(self.font())
                elif min_p and max_p and min_p < line_num < max_p:
                    painter.setBrush(QBrush(QColor("#89B4FA")))
                    painter.setPen(Qt.PenStyle.NoPen)
                    painter.drawEllipse(dot_center_x - 3, dot_center_y - 3, 6, 6)
                else:
                    is_hovered = (line_num == self.line_number_area.hovered_line)
                    if is_hovered:
                        painter.setBrush(QBrush(QColor("#CDD6F4")))
                        painter.setPen(QPen(QColor("#89B4FA"), 1))
                        painter.drawEllipse(dot_center_x - 4, dot_center_y - 4, 8, 8)
                    else:
                        painter.setBrush(QBrush(QColor("#313244")))
                        painter.setPen(Qt.PenStyle.NoPen)
                        painter.drawEllipse(dot_center_x - 2, dot_center_y - 2, 4, 4)

            block = block.next()
            top = bottom
            bottom = top + int(self.blockBoundingRect(block).height())
            block_number += 1

    def lineNumberAreaMousePress(self, event: QMouseEvent):
        line = self.getLineAtY(event.position().y())
        if not line:
            return

        if event.button() == Qt.MouseButton.RightButton:
            menu = QMenu(self)
            act_a = menu.addAction(f"📍 Nokta A Yap (Satır {line})")
            act_b = menu.addAction(f"📍 Nokta B Yap (Satır {line})")
            menu.addSeparator()
            act_copy = menu.addAction("📋 Aralığı Kopyala")
            act_copy.setEnabled(self.point_a is not None and self.point_b is not None)
            act_clear = menu.addAction("❌ Noktaları Temizle")
            act_clear.setEnabled(self.point_a is not None or self.point_b is not None)

            action = menu.exec(event.globalPosition().toPoint())
            if action == act_a:
                self.setPointA(line)
            elif action == act_b:
                self.setPointB(line)
            elif action == act_copy:
                self.copySelectedRange()
            elif action == act_clear:
                self.clearPoints()
            return

        if self.point_a is None:
            self.setPointA(line)
        elif self.point_b is None:
            if line == self.point_a:
                self.clearPoints()
            else:
                self.setPointB(line)
        else:
            if line == self.point_a or line == self.point_b:
                self.clearPoints()
            else:
                self.setPointA(line)
                self.point_b = None
                self.line_number_area.update()
                self.highlightCurrentLineAndSelections()
                self.range_cleared.emit()

    def setPointA(self, line: int):
        self.point_a = line
        self.line_number_area.update()
        self.highlightCurrentLineAndSelections()
        if self.point_b is not None:
            self._notify_range()
        else:
            self.status_message.emit(f"📍 Nokta A seçildi (Satır {line}). İkinci bir satıra tıklayarak Nokta B'yi belirleyin.")

    def setPointB(self, line: int):
        self.point_b = line
        self.line_number_area.update()
        self.highlightCurrentLineAndSelections()
        self._notify_range()

    def _notify_range(self):
        if self.point_a is not None and self.point_b is not None:
            start = min(self.point_a, self.point_b)
            end = max(self.point_a, self.point_b)
            text = self.getTextBetweenLines(start, end)
            self.range_selected.emit(start, end, text)
            self.status_message.emit(f"✓ Nokta A ({start}) ve Nokta B ({end}) seçildi. {end - start + 1} satır aralıkta.")

    def clearPoints(self):
        self.point_a = None
        self.point_b = None
        self.line_number_area.update()
        self.highlightCurrentLineAndSelections()
        self.range_cleared.emit()
        self.status_message.emit("Seçim noktaları temizlendi.")

    def getTextBetweenLines(self, start_line: int, end_line: int) -> str:
        doc = self.document()
        lines = []
        for l in range(start_line - 1, end_line):
            b = doc.findBlockByLineNumber(l)
            if b.isValid():
                lines.append(b.text())
        return "\n".join(lines)

    def copySelectedRange(self) -> str:
        if self.point_a is None or self.point_b is None:
            return ""
        start = min(self.point_a, self.point_b)
        end = max(self.point_a, self.point_b)
        text = self.getTextBetweenLines(start, end)
        QApplication.clipboard().setText(text)
        self.status_message.emit(f"📋 Satır {start} - {end} arası panoya kopyalandı ({len(text)} karakter).")
        return text

    # --- Tıklanan Kelime ve Satır Vurgulama ---

    def mouseReleaseEvent(self, event: QMouseEvent):
        super().mouseReleaseEvent(event)
        if event.button() == Qt.MouseButton.LeftButton:
            cursor = self.cursorForPosition(event.position().toPoint())
            cursor.select(QTextCursor.SelectionType.WordUnderCursor)
            word = cursor.selectedText().strip()

            if word and len(word) >= 2:
                self.applyWordHighlight(word)
            else:
                self.clearWordHighlight()

    def applyWordHighlight(self, word: str, emit_signal: bool = True):
        if getattr(self, '_highlighting_lock', False):
            return
        self._highlighting_lock = True
        try:
            if self.clicked_word == word and not emit_signal:
                return

            self.clicked_word = word
            self.highlighter.set_highlight_word(word)

            self.clicked_word_lines.clear()
            doc = self.document()
            escaped = re.escape(word)
            pattern = re.compile(rf'\b{escaped}\b' if word.isalnum() else escaped, re.IGNORECASE)

            occurrences = 0
            for i in range(doc.blockCount()):
                block = doc.findBlockByLineNumber(i)
                if block.isValid() and pattern.search(block.text()):
                    self.clicked_word_lines.add(i + 1)
                    occurrences += len(pattern.findall(block.text()))

            self.highlightCurrentLineAndSelections()

            if emit_signal:
                self.word_clicked.emit(word, occurrences, len(self.clicked_word_lines))
            self.status_message.emit(f"🔍 '{word}' vurgulandı: {len(self.clicked_word_lines)} satırda {occurrences} eşleşme bulundu.")
        finally:
            self._highlighting_lock = False

    def apply_external_word_highlight(self, word: str):
        """Diğer panellerden gelen eşzamanlı kelime vurgulama isteği (sinyal döngüsünü engeller)."""
        if word:
            self.applyWordHighlight(word, emit_signal=False)
        else:
            self.clearWordHighlight()

    def clearWordHighlight(self):
        if self.clicked_word:
            self.clicked_word = ""
            self.clicked_word_lines.clear()
            self.highlighter.set_highlight_word("")
            self.highlightCurrentLineAndSelections()

    # --- ExtraSelection Satır Vurguları ---

    def highlightCurrentLineAndSelections(self):
        extra_selections: List[QTextEdit.ExtraSelection] = []
        doc = self.document()

        # 1. Tıklanan kelimeyi içeren tüm satırlar
        if self.clicked_word_lines:
            word_line_color = QColor("#313244")
            for line_no in self.clicked_word_lines:
                block = doc.findBlockByLineNumber(line_no - 1)
                if block.isValid():
                    sel = QTextEdit.ExtraSelection()
                    sel.format.setBackground(word_line_color)
                    sel.format.setProperty(QTextFormat.Property.FullWidthSelection, True)
                    cursor = QTextCursor(block)
                    sel.cursor = cursor
                    extra_selections.append(sel)

        # 2. Nokta A ve B arasındaki satırlar
        if self.point_a is not None and self.point_b is not None:
            range_bg_color = QColor(40, 70, 95, 180)
            start = min(self.point_a, self.point_b)
            end = max(self.point_a, self.point_b)
            for line_no in range(start, end + 1):
                block = doc.findBlockByLineNumber(line_no - 1)
                if block.isValid():
                    sel = QTextEdit.ExtraSelection()
                    sel.format.setBackground(range_bg_color)
                    sel.format.setProperty(QTextFormat.Property.FullWidthSelection, True)
                    cursor = QTextCursor(block)
                    sel.cursor = cursor
                    extra_selections.append(sel)

        self.setExtraSelections(extra_selections)

    # --- Arama ve İçeren Satırları Kopyalama ---

    def copyMatchingLines(self, query: str, is_regex: bool = False, case_sensitive: bool = False) -> str:
        if not query:
            return ""

        flags = 0 if case_sensitive else re.IGNORECASE
        try:
            pattern = re.compile(query if is_regex else re.escape(query), flags)
        except re.error:
            return ""

        matched = [line for line in self.raw_lines if pattern.search(line)]
        result = "\n".join(matched)
        if result:
            QApplication.clipboard().setText(result)
            self.status_message.emit(f"📋 Eşleşen {len(matched)} satır panoya kopyalandı!")
        else:
            self.status_message.emit("Eşleşen satır bulunamadı.")
        return result
