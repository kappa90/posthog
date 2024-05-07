import { useActions, useValues } from 'kea'
import { TaxonomicFilterGroupType } from 'lib/components/TaxonomicFilter/types'
import { FEATURE_FLAGS } from 'lib/constants'
import { featureFlagLogic } from 'lib/logic/featureFlagLogic'
import { insightVizDataLogic } from 'scenes/insights/insightVizDataLogic'
import { keyForInsightLogicProps } from 'scenes/insights/sharedUtils'

import { actionsModel } from '~/models/actionsModel'
import { groupsModel } from '~/models/groupsModel'
import { StickinessQuery, TrendsQuery } from '~/queries/schema'
import { EditorFilterProps } from '~/types'

import { PropertyGroupFilters } from './PropertyGroupFilters/PropertyGroupFilters'
import { getAllEventNames } from './utils'

export function GlobalAndOrFilters({ insightProps }: EditorFilterProps): JSX.Element {
    const { actions: allActions } = useValues(actionsModel)
    const { groupsTaxonomicTypes } = useValues(groupsModel)
    const { isTrends, querySource, isDataWarehouseSeries } = useValues(insightVizDataLogic(insightProps))
    const { updateQuerySource } = useActions(insightVizDataLogic(insightProps))
    const { featureFlags } = useValues(featureFlagLogic)

    const taxonomicGroupTypes = [
        TaxonomicFilterGroupType.EventProperties,
        TaxonomicFilterGroupType.PersonProperties,
        TaxonomicFilterGroupType.EventFeatureFlags,
        ...groupsTaxonomicTypes,
        TaxonomicFilterGroupType.Cohorts,
        TaxonomicFilterGroupType.Elements,
        ...(isTrends ? [TaxonomicFilterGroupType.SessionProperties] : []),
        TaxonomicFilterGroupType.HogQLExpression,
        ...(featureFlags[FEATURE_FLAGS.DATA_WAREHOUSE] ? [TaxonomicFilterGroupType.DataWarehousePersonProperties] : []),
    ]

    return (
        <PropertyGroupFilters
            insightProps={insightProps}
            pageKey={`${keyForInsightLogicProps('new')(insightProps)}-GlobalAndOrFilters`}
            query={querySource as TrendsQuery | StickinessQuery}
            setQuery={updateQuerySource}
            eventNames={getAllEventNames(querySource as TrendsQuery | StickinessQuery, allActions)}
            taxonomicGroupTypes={taxonomicGroupTypes}
            isDataWarehouseSeries={isDataWarehouseSeries}
        />
    )
}
