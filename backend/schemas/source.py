from pydantic import AwareDatetime, HttpUrl

from .base import ContractModel, Identifier


class SourceRef(ContractModel):
    source_id: Identifier
    title: Identifier
    url: HttpUrl
    publisher: Identifier
    retrieved_at: AwareDatetime
    version: Identifier
    licence: Identifier
