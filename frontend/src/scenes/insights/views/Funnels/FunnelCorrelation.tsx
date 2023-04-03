import { useValues } from 'kea'
import { funnelLogic } from 'scenes/funnels/funnelLogic'
import './FunnelCorrelation.scss'
import { AvailableFeature } from '~/types'
import { insightLogic } from 'scenes/insights/insightLogic'
import { FunnelCorrelationTable, FunnelCorrelationTableDataExploration } from './FunnelCorrelationTable'
import { FunnelPropertyCorrelationTable } from './FunnelPropertyCorrelationTable'
import { PayGateMini } from 'lib/components/PayGateMini/PayGateMini'
import { funnelDataLogic } from 'scenes/funnels/funnelDataLogic'
import { FunnelCorrelationSkewWarning } from './FunnelCorrelationSkewWarning'
import { FunnelCorrelationFeedbackForm } from './FunnelCorrelationFeedbackForm'

export const FunnelCorrelation = (): JSX.Element | null => {
    const { insightProps, isUsingDataExploration } = useValues(insightLogic)
    const { steps: legacySteps } = useValues(funnelLogic(insightProps))
    const { steps } = useValues(funnelDataLogic(insightProps))

    if (isUsingDataExploration ? steps.length <= 1 : legacySteps.length <= 1) {
        return null
    }

    return (
        <>
            <h2 className="my-4">Correlation analysis</h2>
            <PayGateMini feature={AvailableFeature.CORRELATION_ANALYSIS}>
                <div className="funnel-correlation">
                    {!isUsingDataExploration && <FunnelCorrelationSkewWarning />}
                    {isUsingDataExploration ? <FunnelCorrelationTableDataExploration /> : <FunnelCorrelationTable />}
                    {!isUsingDataExploration && <FunnelCorrelationFeedbackForm />}
                    {!isUsingDataExploration && <FunnelPropertyCorrelationTable />}
                </div>
            </PayGateMini>
        </>
    )
}
