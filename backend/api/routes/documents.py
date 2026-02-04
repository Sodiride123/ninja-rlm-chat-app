"""
Document management API routes.
Handles file uploads, listing, and deletion.
"""

from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import List

from backend.api.schemas import (
    DocumentInfo,
    DocumentListResponse,
    DocumentUploadResponse,
)
from backend.services.document_service import document_service

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_documents(files: List[UploadFile] = File(...)):
    """
    Upload one or more documents.

    Supported formats: PDF, TXT, MD, DOCX
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    uploaded = []
    total_chars = 0

    for file in files:
        # Validate file type
        allowed_types = {
            "application/pdf",
            "text/plain",
            "text/markdown",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
        allowed_extensions = {".pdf", ".txt", ".md", ".docx"}

        # Check by extension if content_type is generic
        ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""

        if file.content_type not in allowed_types and ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.filename} ({file.content_type})"
            )

        # Save and process file
        doc_info = document_service.save_file(
            file=file.file,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
        )

        uploaded.append(DocumentInfo(
            id=doc_info["id"],
            filename=doc_info["filename"],
            size_bytes=doc_info["size_bytes"],
            content_type=doc_info["content_type"],
            char_count=doc_info["char_count"],
            uploaded_at=doc_info["uploaded_at"],
        ))
        total_chars += doc_info["char_count"]

    return DocumentUploadResponse(documents=uploaded, total_chars=total_chars)


@router.get("", response_model=DocumentListResponse)
async def list_documents():
    """List all uploaded documents."""
    docs = document_service.get_all_documents()
    return DocumentListResponse(
        documents=[
            DocumentInfo(
                id=d["id"],
                filename=d["filename"],
                size_bytes=d["size_bytes"],
                content_type=d["content_type"],
                char_count=d["char_count"],
                uploaded_at=d["uploaded_at"],
            )
            for d in docs
        ],
        total_count=len(docs),
    )


@router.get("/{doc_id}", response_model=DocumentInfo)
async def get_document(doc_id: str):
    """Get a specific document by ID."""
    doc = document_service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentInfo(
        id=doc["id"],
        filename=doc["filename"],
        size_bytes=doc["size_bytes"],
        content_type=doc["content_type"],
        char_count=doc["char_count"],
        uploaded_at=doc["uploaded_at"],
    )


@router.get("/{doc_id}/content")
async def get_document_content(doc_id: str):
    """Get the extracted text content of a document."""
    doc = document_service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": doc["id"],
        "filename": doc["filename"],
        "content": doc["text_content"],
        "char_count": doc["char_count"],
    }


@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document by ID."""
    success = document_service.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"success": True, "message": f"Document {doc_id} deleted"}
