"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGasFees = exports.getEngineEvtContainer = void 0;
const vector_types_1 = require("@connext/vector-types");
const vector_utils_1 = require("@connext/vector-utils");
const evt_1 = require("evt");
exports.getEngineEvtContainer = () => {
    return {
        [vector_types_1.EngineEvents.IS_ALIVE]: evt_1.Evt.create(),
        [vector_types_1.EngineEvents.SETUP]: evt_1.Evt.create(),
        [vector_types_1.EngineEvents.CONDITIONAL_TRANSFER_CREATED]: evt_1.Evt.create(),
        [vector_types_1.EngineEvents.CONDITIONAL_TRANSFER_RESOLVED]: evt_1.Evt.create(),
        [vector_types_1.EngineEvents.DEPOSIT_RECONCILED]: evt_1.Evt.create(),
        [vector_types_1.EngineEvents.REQUEST_COLLATERAL]: evt_1.Evt.create(),
        [vector_types_1.EngineEvents.RESTORE_STATE_EVENT]: evt_1.Evt.create(),
        [vector_types_1.EngineEvents.WITHDRAWAL_CREATED]: evt_1.Evt.create(),
        [vector_types_1.EngineEvents.WITHDRAWAL_RESOLVED]: evt_1.Evt.create(),
        [vector_types_1.EngineEvents.WITHDRAWAL_RECONCILED]: evt_1.Evt.create(),
        [vector_types_1.TransactionEvents.TRANSACTION_SUBMITTED]: evt_1.Evt.create(),
        [vector_types_1.TransactionEvents.TRANSACTION_MINED]: evt_1.Evt.create(),
        [vector_types_1.TransactionEvents.TRANSACTION_FAILED]: evt_1.Evt.create(),
    };
};
function normalizeGasFees(fee, baseAssetDecimals, desiredFeeAssetId, desiredFeeAssetDecimals, chainId, ethReader, logger, gasPriceOverride) {
    return vector_utils_1.normalizeFee(fee, baseAssetDecimals, desiredFeeAssetId, desiredFeeAssetDecimals, chainId, ethReader, logger, gasPriceOverride);
}
exports.normalizeGasFees = normalizeGasFees;
//# sourceMappingURL=utils.js.map