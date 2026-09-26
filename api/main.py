from fastapi import FastAPI, HTTPException

from api.models import (
    ClarifyRequest,
    IngestRequest,
    NegotiateRequest,
    PhotonInbound,
    SearchRequest,
    SelectRequest,
)

app = FastAPI(title="JEVgotiator", version="0.1.0")


def not_implemented(owner: str) -> HTTPException:
    return HTTPException(status_code=501, detail=f"Not implemented yet (owner: {owner})")


@app.get("/health")
def health():
    return {"status": "ok", "db": "unknown", "version": app.version}


@app.post("/v1/clarify")
def clarify(req: ClarifyRequest):
    raise not_implemented("Ben")


@app.post("/v1/search")
def search(req: SearchRequest):
    raise not_implemented("Ben")


@app.post("/v1/sessions/{session_id}/select")
def select(session_id: str, req: SelectRequest):
    raise not_implemented("Ben")


@app.post("/v1/negotiate")
def negotiate(req: NegotiateRequest):
    raise not_implemented("Dara")


@app.get("/v1/listings")
def list_listings():
    raise not_implemented("Chris")


@app.post("/v1/listings/ingest")
def ingest(req: IngestRequest):
    raise not_implemented("Chris")


@app.post("/webhooks/photon")
def photon_webhook(evt: PhotonInbound):
    raise not_implemented("Ben")
