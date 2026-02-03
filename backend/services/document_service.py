"""
Document service for handling file uploads and text extraction.
Supports PDF, TXT, DOCX, and MD files.
"""

import hashlib
import os
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

from backend.config import settings


class DocumentService:
    """Service for managing document uploads and parsing."""

    def __init__(self):
        self.upload_dir = settings.upload_dir
        self.upload_dir.mkdir(parents=True, exist_ok=True)

        # In-memory document registry (MVP: no persistence)
        self._documents: dict[str, dict] = {}

    def save_file(self, file: BinaryIO, filename: str, content_type: str) -> dict:
        """
        Save an uploaded file and extract its text content.

        Returns document info dict with id, filename, content, etc.
        """
        # Generate unique ID from content hash
        content = file.read()
        file.seek(0)
        doc_id = hashlib.sha256(content + filename.encode()).hexdigest()[:16]

        # Save original file
        safe_filename = self._sanitize_filename(filename)
        file_path = self.upload_dir / f"{doc_id}_{safe_filename}"

        with open(file_path, "wb") as f:
            f.write(content)

        # Extract text content
        text_content = self._extract_text(file_path, content_type)

        # Create document record
        doc_info = {
            "id": doc_id,
            "filename": filename,
            "file_path": str(file_path),
            "size_bytes": len(content),
            "content_type": content_type,
            "text_content": text_content,
            "char_count": len(text_content),
            "uploaded_at": datetime.utcnow(),
        }

        self._documents[doc_id] = doc_info
        return doc_info

    def get_document(self, doc_id: str) -> dict | None:
        """Get document info by ID."""
        return self._documents.get(doc_id)

    def get_all_documents(self) -> list[dict]:
        """Get all documents."""
        return list(self._documents.values())

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document."""
        doc = self._documents.get(doc_id)
        if not doc:
            return False

        # Remove file
        file_path = Path(doc["file_path"])
        if file_path.exists():
            file_path.unlink()

        del self._documents[doc_id]
        return True

    def get_combined_context(self, doc_ids: list[str]) -> str:
        """
        Combine multiple documents into a single context string.
        Format: Each document is wrapped with markers for clarity.
        """
        parts = []
        for doc_id in doc_ids:
            doc = self._documents.get(doc_id)
            if doc:
                parts.append(f"=== Document: {doc['filename']} ===\n{doc['text_content']}\n")

        return "\n".join(parts)

    def get_total_chars(self, doc_ids: list[str]) -> int:
        """Get total character count for given documents."""
        total = 0
        for doc_id in doc_ids:
            doc = self._documents.get(doc_id)
            if doc:
                total += doc["char_count"]
        return total

    def _extract_text(self, file_path: Path, content_type: str) -> str:
        """Extract text content from a file based on its type."""
        suffix = file_path.suffix.lower()

        if suffix == ".txt" or suffix == ".md":
            return self._extract_text_file(file_path)
        elif suffix == ".pdf":
            return self._extract_pdf(file_path)
        elif suffix == ".docx":
            return self._extract_docx(file_path)
        else:
            # Fallback: try to read as text
            try:
                return self._extract_text_file(file_path)
            except Exception:
                return f"[Unable to extract text from {file_path.name}]"

    def _extract_text_file(self, file_path: Path) -> str:
        """Read plain text file."""
        encodings = ["utf-8", "latin-1", "cp1252"]
        for encoding in encodings:
            try:
                with open(file_path, "r", encoding=encoding) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        return "[Unable to decode text file]"

    def _extract_pdf(self, file_path: Path) -> str:
        """Extract text from PDF using pypdf."""
        try:
            from pypdf import PdfReader

            reader = PdfReader(file_path)
            text_parts = []
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"[Page {i + 1}]\n{page_text}")

            return "\n\n".join(text_parts)
        except ImportError:
            return "[PDF extraction requires pypdf: pip install pypdf]"
        except Exception as e:
            return f"[Error extracting PDF: {e}]"

    def _extract_docx(self, file_path: Path) -> str:
        """Extract text from DOCX using python-docx."""
        try:
            from docx import Document

            doc = Document(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n\n".join(paragraphs)
        except ImportError:
            return "[DOCX extraction requires python-docx: pip install python-docx]"
        except Exception as e:
            return f"[Error extracting DOCX: {e}]"

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to prevent path traversal."""
        # Remove any path components
        filename = os.path.basename(filename)
        # Replace problematic characters
        for char in ['/', '\\', '..', '\x00']:
            filename = filename.replace(char, '_')
        return filename


# Global service instance
document_service = DocumentService()
