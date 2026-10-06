import { createInitialCanonicalCandidate } from '../../src/canonical/runtime'
import { createManMasterBootstrapCandidate } from '../../src/canonical/masterBootstrap'
import { createAndroidManMenuProposal } from '../../src/canonical/manMenuProposal'
import { createMenuProposalCandidate } from '../../src/canonical/trainer'
import { validateCanonical } from '../../src/canonical/validate'

export const at = '2026-10-07T00:00:00.000Z'
let sequence = 0
const newId = () => `h17-fixture-${String(++sequence).padStart(2, '0')}`
const initial = createInitialCanonicalCandidate({ weight: 66 })
const bootstrap = createManMasterBootstrapCandidate(initial, { includeFrontPlank: false, newId, now: () => at })
const proposal = createAndroidManMenuProposal(bootstrap.value, bootstrap.mappings, { includeTime: false, newId })
if (!proposal.ok) throw Error('Fixture proposal invalid')
const applied = createMenuProposalCandidate(bootstrap.value, proposal.proposal, newId)
export const fixture = { ...applied.data, activeMenuId: applied.menu.id }
if (validateCanonical(fixture).errors.length || fixture.sessions.length) throw Error('Fixture invalid')
