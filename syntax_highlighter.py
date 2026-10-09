import re
from PyQt6.QtGui import QSyntaxHighlighter, QTextCharFormat, QColor, QFont
from PyQt6.QtCore import Qt

class Esp32SyntaxHighlighter(QSyntaxHighlighter):
    def __init__(self, document):
        super().__init__(document)
        self.highlight_word = ""
        self.search_pattern = ""
        self.search_regex = False
        self.search_case_sensitive = False

        self._init_formats()
        self._init_rules()

    def _init_formats(self):
        # 1. Rakamlar (Numbers)
        self.fmt_number = QTextCharFormat()
        self.fmt_number.setForeground(QColor("#61AFEF"))  # Açık mavi/cyan
        self.fmt_number.setFontWeight(QFont.Weight.Medium)

        self.fmt_hex = QTextCharFormat()
        self.fmt_hex.setForeground(QColor("#D19A66"))  # Turuncu/Gold
        self.fmt_hex.setFontWeight(QFont.Weight.Bold)

        # 2. Başlıklar ("title: ", etiketler, boot başlıkları)
        self.fmt_title = QTextCharFormat()
        self.fmt_title.setForeground(QColor("#E5C07B"))  # Canlı sarı/altın
        self.fmt_title.setFontWeight(QFont.Weight.Bold)

        self.fmt_header_key = QTextCharFormat()
        self.fmt_header_key.setForeground(QColor("#98C379"))  # Yeşilimsi başlık
        self.fmt_header_key.setFontWeight(QFont.Weight.Bold)

        self.fmt_crash = QTextCharFormat()
        self.fmt_crash.setForeground(QColor("#FF4C4C"))  # Kırmızı
        self.fmt_crash.setFontWeight(QFont.Weight.Bold)

        # 3. Parantezler ve içleri
        # Normal parantez ()
        self.fmt_paren_bracket = QTextCharFormat()
        self.fmt_paren_bracket.setForeground(QColor("#56B6C2"))  # Camgöbeği parantez
        self.fmt_paren_bracket.setFontWeight(QFont.Weight.Bold)

        self.fmt_paren_inside = QTextCharFormat()
        self.fmt_paren_inside.setForeground(QColor("#40C4FF"))  # Yumuşak açık mavi iç kısım

        # Köşeli parantez []
        self.fmt_square_bracket = QTextCharFormat()
        self.fmt_square_bracket.setForeground(QColor("#C678DD"))  # Mor köşeli parantez
        self.fmt_square_bracket.setFontWeight(QFont.Weight.Bold)

        self.fmt_square_inside = QTextCharFormat()
        self.fmt_square_inside.setForeground(QColor("#E06C75"))  # Gül kurusu iç kısım

        # Süslü parantez {}
        self.fmt_curly_bracket = QTextCharFormat()
        self.fmt_curly_bracket.setForeground(QColor("#E5C07B"))  # Altın süslü parantez
        self.fmt_curly_bracket.setFontWeight(QFont.Weight.Bold)

        self.fmt_curly_inside = QTextCharFormat()
        self.fmt_curly_inside.setForeground(QColor("#D19A66"))  # Turuncu iç kısım

        # 4. ESP-IDF Log Seviyeleri (E, W, I, D, V)
        self.fmt_log_error = QTextCharFormat()
        self.fmt_log_error.setForeground(QColor("#FF5370"))
        self.fmt_log_error.setFontWeight(QFont.Weight.Bold)

        self.fmt_log_warn = QTextCharFormat()
        self.fmt_log_warn.setForeground(QColor("#FFCB6B"))
        self.fmt_log_warn.setFontWeight(QFont.Weight.Bold)

        self.fmt_log_info = QTextCharFormat()
        self.fmt_log_info.setForeground(QColor("#C3E88D"))
        self.fmt_log_info.setFontWeight(QFont.Weight.Bold)

        self.fmt_log_debug = QTextCharFormat()
        self.fmt_log_debug.setForeground(QColor("#82AAFF"))
        self.fmt_log_debug.setFontWeight(QFont.Weight.Bold)

        self.fmt_log_verbose = QTextCharFormat()
        self.fmt_log_verbose.setForeground(QColor("#C792EA"))
        self.fmt_log_verbose.setFontWeight(QFont.Weight.Bold)

        # 5. Tıklanan Kelime Vurgulama
        self.fmt_word_highlight = QTextCharFormat()
        self.fmt_word_highlight.setBackground(QColor("#5C4033"))  # Belirgin koyu turuncu/amber arka plan
        self.fmt_word_highlight.setForeground(QColor("#FFFFFF"))
        self.fmt_word_highlight.setFontWeight(QFont.Weight.Bold)

        # 6. Arama Sonucu Vurgulama
        self.fmt_search_highlight = QTextCharFormat()
        self.fmt_search_highlight.setBackground(QColor("#1B5E20"))  # Yeşil arama vurgusu
        self.fmt_search_highlight.setForeground(QColor("#FFFFFF"))
        self.fmt_search_highlight.setFontWeight(QFont.Weight.Bold)

    def _init_rules(self):
        # Regex kuralları
        # Başlık ("title: ...") ve türevleri
        self.regex_title = re.compile(r'(?i)\btitle\s*:\s*[^\r\n,;]+')
        self.regex_header_keys = re.compile(r'^\s*([a-zA-Z_0-9\-]+:)\s+')
        self.regex_crash = re.compile(r'(?i)(guru meditation error[^\r\n]*|backtrace:[^\r\n]*|abort\(\)[^\r\n]*)')

        # ESP-IDF Log seviyeleri: E (1234) TAG:
        self.regex_log_error = re.compile(r'\bE\s*\(\d+\)\s*[^:]+:')
        self.regex_log_warn = re.compile(r'\bW\s*\(\d+\)\s*[^:]+:')
        self.regex_log_info = re.compile(r'\bI\s*\(\d+\)\s*[^:]+:')
        self.regex_log_debug = re.compile(r'\bD\s*\(\d+\)\s*[^:]+:')
        self.regex_log_verbose = re.compile(r'\bV\s*\(\d+\)\s*[^:]+:')

        # Parantez kuralları
        self.regex_paren = re.compile(r'\(([^()\r\n]*)\)')
        self.regex_square = re.compile(r'\[([^\[\]\r\n]*)\]')
        self.regex_curly = re.compile(r'\{([^{}\r\n]*)\}')

        # Rakamlar: Hex ve ondalık
        self.regex_hex = re.compile(r'\b0x[0-9a-fA-F]+\b')
        self.regex_number = re.compile(r'(?<![0-9a-zA-Z_])-?\b\d+(\.\d+)?\b')

    def set_highlight_word(self, word: str):
        if self.highlight_word != word:
            self.highlight_word = word
            self.rehighlight()

    def set_search_query(self, pattern: str, is_regex: bool = False, case_sensitive: bool = False):
        if (self.search_pattern != pattern or
            self.search_regex != is_regex or
            self.search_case_sensitive != case_sensitive):
            self.search_pattern = pattern
            self.search_regex = is_regex
            self.search_case_sensitive = case_sensitive
            self.rehighlight()

    def highlightBlock(self, text: str):
        if not text:
            return

        # 1. Rakamlar
        for m in self.regex_number.finditer(text):
            self.setFormat(m.start(), m.end() - m.start(), self.fmt_number)

        for m in self.regex_hex.finditer(text):
            self.setFormat(m.start(), m.end() - m.start(), self.fmt_hex)

        # 2. Başlıklar & Etiketler
        for m in self.regex_header_keys.finditer(text):
            self.setFormat(m.start(1), len(m.group(1)), self.fmt_header_key)

        for m in self.regex_title.finditer(text):
            self.setFormat(m.start(), m.end() - m.start(), self.fmt_title)

        for m in self.regex_crash.finditer(text):
            self.setFormat(m.start(), m.end() - m.start(), self.fmt_crash)

        # 3. ESP-IDF Log seviyeleri
        for m in self.regex_log_error.finditer(text):
            self.setFormat(m.start(), m.end() - m.start(), self.fmt_log_error)

        for m in self.regex_log_warn.finditer(text):
            self.setFormat(m.start(), m.end() - m.start(), self.fmt_log_warn)

        for m in self.regex_log_info.finditer(text):
            self.setFormat(m.start(), m.end() - m.start(), self.fmt_log_info)

        for m in self.regex_log_debug.finditer(text):
            self.setFormat(m.start(), m.end() - m.start(), self.fmt_log_debug)

        for m in self.regex_log_verbose.finditer(text):
            self.setFormat(m.start(), m.end() - m.start(), self.fmt_log_verbose)

        # 4. Parantezler ve içleri
        # () parantez
        for m in self.regex_paren.finditer(text):
            # Açılış parantezi
            self.setFormat(m.start(), 1, self.fmt_paren_bracket)
            # İç kısım
            inner_len = len(m.group(1))
            if inner_len > 0:
                self.setFormat(m.start(1), inner_len, self.fmt_paren_inside)
            # Kapanış parantezi
            self.setFormat(m.end() - 1, 1, self.fmt_paren_bracket)

        # [] köşeli parantez
        for m in self.regex_square.finditer(text):
            self.setFormat(m.start(), 1, self.fmt_square_bracket)
            inner_len = len(m.group(1))
            if inner_len > 0:
                self.setFormat(m.start(1), inner_len, self.fmt_square_inside)
            self.setFormat(m.end() - 1, 1, self.fmt_square_bracket)

        # {} süslü parantez
        for m in self.regex_curly.finditer(text):
            self.setFormat(m.start(), 1, self.fmt_curly_bracket)
            inner_len = len(m.group(1))
            if inner_len > 0:
                self.setFormat(m.start(1), inner_len, self.fmt_curly_inside)
            self.setFormat(m.end() - 1, 1, self.fmt_curly_bracket)

        # 5. Tıklanan Kelime Vurgulama (Match Occurrences)
        if self.highlight_word and len(self.highlight_word.strip()) >= 2:
            escaped = re.escape(self.highlight_word)
            pattern = re.compile(rf'\b{escaped}\b' if self.highlight_word.isalnum() else escaped, re.IGNORECASE)
            for m in pattern.finditer(text):
                self.setFormat(m.start(), m.end() - m.start(), self.fmt_word_highlight)

        # 6. Arama Vurgulama
        if self.search_pattern:
            try:
                flags = 0 if self.search_case_sensitive else re.IGNORECASE
                if self.search_regex:
                    s_re = re.compile(self.search_pattern, flags)
                else:
                    s_re = re.compile(re.escape(self.search_pattern), flags)
                for m in s_re.finditer(text):
                    self.setFormat(m.start(), m.end() - m.start(), self.fmt_search_highlight)
            except re.error:
                pass
