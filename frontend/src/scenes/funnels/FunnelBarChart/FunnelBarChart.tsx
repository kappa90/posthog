import { useValues } from 'kea'
import { useMemo } from 'react'
import { funnelLogic } from '../funnelLogic'
import './FunnelBarChart.scss'
import { ChartParams } from '~/types'
import clsx from 'clsx'
import { useScrollable } from 'lib/hooks/useScrollable'
import { useResizeObserver } from 'lib/hooks/useResizeObserver'
import { useFunnelTooltip } from '../useFunnelTooltip'
import { StepLegend } from './StepLegend'
import { StepBars } from './StepBars'

function StepBarLabels(): JSX.Element {
    return (
        <div className="StepBarLabels">
            {Array(6)
                .fill(null)
                .map((_, i) => (
                    <div key={i} className="StepBarLabels__segment">
                        <div className="StepBarLabels__label">{i * 20}%</div>
                    </div>
                ))}
        </div>
    )
}

interface FunnelBarChartCSSProperties extends React.CSSProperties {
    '--bar-width': string
    '--bar-row-height': string
}

/** Funnel results in bar form. Requires `funnelLogic` to be bound. */
export function FunnelBarChart({ showPersonsModal = true }: ChartParams): JSX.Element {
    const { visibleStepsWithConversionMetrics } = useValues(funnelLogic)

    const [scrollRef, scrollableClassNames] = useScrollable()
    const { height } = useResizeObserver({ ref: scrollRef })

    const seriesCount = visibleStepsWithConversionMetrics[0]?.nested_breakdown?.length ?? 0
    const barWidthPx =
        seriesCount >= 60
            ? 4
            : seriesCount >= 20
            ? 8
            : seriesCount >= 12
            ? 16
            : seriesCount >= 10
            ? 20
            : seriesCount >= 8
            ? 24
            : seriesCount >= 6
            ? 32
            : seriesCount >= 5
            ? 40
            : seriesCount >= 4
            ? 48
            : seriesCount >= 3
            ? 64
            : seriesCount >= 2
            ? 96
            : 192

    const vizRef = useFunnelTooltip(showPersonsModal)

    const table = useMemo(() => {
        /** Average conversion time is only shown if it's known for at least one step. */
        // != is intentional to catch undefined too
        const showTime = visibleStepsWithConversionMetrics.some((step) => step.average_conversion_time != null)
        const barRowHeight = `calc(${height}px - 3rem - (1.75rem * ${showTime ? 3 : 2}) - 1px)`

        return (
            <table
                /* eslint-disable-next-line react/forbid-dom-props */
                style={
                    {
                        '--bar-width': `${barWidthPx}px`,
                        '--bar-row-height': barRowHeight,
                    } as FunnelBarChartCSSProperties
                }
            >
                <colgroup>
                    {visibleStepsWithConversionMetrics.map((_, i) => (
                        <col key={i} width={0} />
                    ))}
                    <col width="100%" />
                    {/* The last column is meant to fill up leftover space. */}
                </colgroup>
                <tbody>
                    <tr>
                        <td>
                            <StepBarLabels />
                        </td>
                        {visibleStepsWithConversionMetrics.map((step, stepIndex) => (
                            <td key={stepIndex}>
                                <StepBars step={step} stepIndex={stepIndex} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td />
                        {visibleStepsWithConversionMetrics.map((step, stepIndex) => (
                            <td key={stepIndex}>
                                <StepLegend
                                    step={step.nested_breakdown?.length ? step.nested_breakdown[0] : step}
                                    stepIndex={stepIndex}
                                    showTime={showTime}
                                    showPersonsModal={showPersonsModal}
                                />
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
        )
    }, [visibleStepsWithConversionMetrics, height])

    return (
        <div className={clsx('FunnelBarChart', ...scrollableClassNames)} ref={vizRef} data-attr="funnel-bar-graph">
            <div className="scrollable__inner" ref={scrollRef}>
                {table}
            </div>
        </div>
    )
}
