"""Action handlers. `run(col, action, params)` takes an anki.collection.Collection."""
import base64

from anki.collection import SearchNode


def _model(col, name):
    m = col.models.by_name(name)
    if m is None:
        raise Exception(f"model was not found: {name}")
    return m


def _info(col, nid):
    try:
        note = col.get_note(nid)
    except Exception:
        return {}
    fields = {f["name"]: {"value": note.fields[f["ord"]], "order": f["ord"]}
              for f in note.note_type()["flds"]}
    return {"noteId": note.id, "modelName": note.note_type()["name"],
            "tags": list(note.tags), "fields": fields, "cards": list(note.card_ids())}


def _store(col, filename, data):
    return col.media.write_data(filename, base64.b64decode(data))


def _add_note(col, n):
    deck_id = col.decks.id_for_name(n["deckName"])
    if not deck_id:
        raise Exception(f"deck was not found: {n['deckName']}")
    model = _model(col, n["modelName"])
    note = col.new_note(model)
    names = {f["name"] for f in model["flds"]}
    for k, v in n.get("fields", {}).items():
        if k not in names:
            raise Exception(f"field not found: {k}")
        note[k] = v
    for kind, tpl in (("picture", '<img src="{}">'), ("audio", "[sound:{}]")):
        for item in n.get(kind) or []:
            name = _store(col, item["filename"], item["data"])
            for f in item.get("fields", []):
                if f not in names:
                    raise Exception(f"field not found: {f}")
                note[f] += tpl.format(name)
    first = note.fields[0]
    if not first.strip():
        raise Exception("cannot create note because it is empty")
    opts = n.get("options") or {}
    if not opts.get("allowDuplicate"):
        nodes = [SearchNode(dupe=SearchNode.Dupe(notetype_id=model["id"], first_field=first))]
        if opts.get("duplicateScope") == "deck":
            nodes.append(SearchNode(deck=n["deckName"]))
        if col.find_notes(col.build_search_string(*nodes)):
            raise Exception("cannot create note because it is a duplicate")
    note.tags = list(n.get("tags") or [])
    col.add_note(note, deck_id)
    return note.id


def run(col, action, p):
    if action == "version":
        return 6
    if action == "requestPermission":
        return {"permission": "granted", "requireApikey": False, "version": 6}
    if action == "deckNames":
        return [d.name for d in col.decks.all_names_and_ids()]
    if action == "modelNames":
        return list(col.models.all_names())
    if action == "modelFieldNames":
        return [f["name"] for f in _model(col, p["modelName"])["flds"]]
    if action == "findNotes":
        return [int(i) for i in col.find_notes(p["query"])]
    if action == "findCards":
        return [int(i) for i in col.find_cards(p["query"])]
    if action == "notesInfo":
        return [_info(col, i) for i in p["notes"]]
    if action == "addNote":
        return _add_note(col, p["note"])
    if action == "storeMediaFile":
        return _store(col, p["filename"], p["data"])
    if action == "addTags":
        col.tags.bulk_add(p["notes"], p["tags"])
        return None
    if action == "removeTags":
        col.tags.bulk_remove(p["notes"], p["tags"])
        return None
    if action == "suspend":
        col.sched.suspend_cards(p["cards"])
        return True
    if action == "unsuspend":
        col.sched.unsuspend_cards(p["cards"])
        return True
    raise Exception(f"unsupported action: {action}")
