import * as React from "react";
import ModalLayout from "./ModalLayout";
import OptionContent from "./OptionModal";
import AIFlowSummaryScanModal from "./AIFlowSummaryScanModal";
import AIFlowSummaryModal from "./AIFlowSummaryModal";
import AIScriptsModal from "./AIScriptsModal";

function OptionModal() {
    return (
        <ModalLayout>
            <OptionContent />
        </ModalLayout>
    );
}

export default {
    OptionModal,
    AIFlowSummaryScanModal,
    AIFlowSummaryModal,
    AIScriptsModal,
};
