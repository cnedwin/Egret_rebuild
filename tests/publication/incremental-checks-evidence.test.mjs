// SPDX-License-Identifier: Apache-2.0
// EVIDENCE: the cases of incremental-checks.test.mjs that replay recorded tool or product bytes
// through the maintenance tools. They report from tools/evidence.mjs and never gate a change.
import './incremental-checks.test.mjs?lane=evidence';
