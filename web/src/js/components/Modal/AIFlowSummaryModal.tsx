import React from "react";
import ModalLayout from "./ModalLayout";
import { useAppDispatch, useAppSelector } from "../../ducks";
import * as modalActions from "../../ducks/ui/modal";
import { setSelectedFlowId } from "../../ducks/aiFlowSummaries";

export default function AIFlowSummaryModal() {
    const dispatch = useAppDispatch();
    const flowId = useAppSelector((state) => state.aiFlowSummaries.selectedFlowId);
    const summary = useAppSelector((state) =>
        flowId ? state.aiFlowSummaries.summaries[flowId] : undefined,
    );

    const onClose = () => {
        dispatch(setSelectedFlowId(undefined));
        dispatch(modalActions.hideModal());
    };

    return (
        <ModalLayout>
            <div>
                <div className="modal-header">
                    <button
                        type="button"
                        className="close"
                        data-dismiss="modal"
                        onClick={onClose}
                    >
                        <i className="fa fa-fw fa-times"></i>
                    </button>
                    <div className="modal-title">
                        <h4>AI Summary</h4>
                    </div>
                </div>

                <div className="modal-body">
                    {flowId ? (
                        <div>
                            <p className="small text-muted">
                                Flow: <strong>{flowId}</strong>
                            </p>
                            {summary && (
                                <p className="small text-muted">
                                    RID: <strong>{summary.rid}</strong>
                                    <br />
                                    {summary.method} {summary.url}
                                </p>
                            )}
                            <pre style={{ whiteSpace: "pre-wrap" }}>
                                {summary?.summary ??
                                    "(No summary available for this flow.)"}
                            </pre>
                        </div>
                    ) : (
                        <p>(No flow selected.)</p>
                    )}
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-default" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </ModalLayout>
    );
}
