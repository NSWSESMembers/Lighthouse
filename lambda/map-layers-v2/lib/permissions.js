'use strict';

// Each of the three collaborative-layer permission axes (who can write
// markers, who can delete the layer, who can comment) is a 3-way mode:
// 'anyone' | 'creator' | 'moderators'. 'moderators' always additionally
// allows the creator -- a "moderators can" setting shouldn't lock the
// creator themselves out.
//
// Layers created before this feature only have the old boolean flags
// (readOnly / allowDeleteByOthers / disableComments) and no `moderators`
// list -- the *Mode() readers below fall back to deriving the equivalent
// mode from those booleans so old layers keep behaving exactly as they did.
// disableComments=true had no direct 3-way equivalent (it blocked everyone,
// including the creator); 'creator' is the closest available mode and is
// what new layers get if a user picks "Only I can comment".
const VALID_MODES = new Set(['anyone', 'creator', 'moderators']);

function normalizeMode(value) {
  return VALID_MODES.has(value) ? value : null;
}

function markerMode(layer) {
  return layer.markerMode || (layer.readOnly ? 'creator' : 'anyone');
}

function deleteMode(layer) {
  return layer.deleteMode || (layer.allowDeleteByOthers === false ? 'creator' : 'anyone');
}

function commentMode(layer) {
  return layer.commentMode || (layer.disableComments ? 'creator' : 'anyone');
}

/** Is `memberId` allowed to perform an action gated by `mode` on `layer`? */
function isAuthorized(mode, layer, memberId) {
  if (mode === 'anyone') return true;
  if (!memberId) return false;
  if (memberId === layer.createdByMemberId) return true;
  if (mode === 'moderators') {
    return Array.isArray(layer.moderators) && layer.moderators.some((m) => m?.id === memberId);
  }
  return false;
}

module.exports = { VALID_MODES, normalizeMode, markerMode, deleteMode, commentMode, isAuthorized };
