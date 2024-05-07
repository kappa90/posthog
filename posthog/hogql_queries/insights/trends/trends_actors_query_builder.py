from typing import Optional
from posthog.hogql import ast
from posthog.hogql.constants import LimitContext
from posthog.hogql.parser import parse_expr, parse_select
from posthog.hogql.property import action_to_expr, property_to_expr
from posthog.hogql.timings import HogQLTimings
from posthog.hogql_queries.insights.trends.aggregation_operations import AggregationOperations
from posthog.hogql_queries.utils.query_date_range import QueryDateRange
from posthog.models import Action, Team
from posthog.schema import ActionsNode, Compare, DataWarehouseNode, EventsNode, HogQLQueryModifiers, TrendsQuery


class TrendsActorsQueryBuilder:
    trends_query: TrendsQuery
    team: Team
    timings: HogQLTimings
    modifiers: HogQLQueryModifiers
    limit_context: LimitContext

    entity: EventsNode | ActionsNode
    time_frame: Optional[str]
    breakdown_value: Optional[str | int] = None
    compare_value: Optional[Compare] = None

    def __init__(
        self,
        trends_query: TrendsQuery,
        team: Team,
        timings: HogQLTimings,
        modifiers: HogQLQueryModifiers,
        series_index: int,
        time_frame: Optional[str],
        breakdown_value: Optional[str | int] = None,
        compare_value: Optional[Compare] = None,
        limit_context: LimitContext = LimitContext.QUERY,
    ):
        self.trends_query = trends_query
        self.team = team
        self.timings = timings
        self.modifiers = modifiers
        self.limit_context = limit_context

        entity = trends_query.series[series_index]

        # TODO: Add support for DataWarehouseNode
        if isinstance(entity, DataWarehouseNode):
            raise Exception("DataWarehouseNodes are not supported for trends actors queries")
        else:
            self.entity = entity

        self.time_frame = time_frame
        self.breakdown_value = breakdown_value
        self.compare_value = compare_value

        def build_actors_query(self) -> ast.SelectQuery | ast.SelectUnionQuery:
            # TODO: add matching_events only when including recordings
            return parse_select(
                """
                    SELECT
                        actor_id,
                        count() as event_count,
                        groupUniqArray(100)((timestamp, uuid, $session_id, $window_id)) as matching_events
                    FROM {events_query}
                    GROUP BY actor_id
                """,
                placeholders={"events_query": self._get_events_query()},
            )

    def _get_events_query(
        self,
        time_frame: Optional[str] = None,
        breakdown_filter: Optional[str | int] = None,
    ) -> ast.SelectQuery:
        # breakdown = self._breakdown(is_actors_query=True, breakdown_filter=breakdown_filter)

        # events_filter = self._events_filter(
        #     ignore_breakdowns=False,
        #     breakdown=breakdown,
        #     is_actors_query=True,
        #     breakdown_values_override=breakdown_values_override,
        #     actors_query_time_frame=actors_query_time_frame,
        # )

        query = ast.SelectQuery(
            select=[
                ast.Alias(alias="actor_id", expr=self._actor_id_expr()),
                ast.Field(chain=["e", "timestamp"]),
                ast.Field(chain=["e", "uuid"]),
                ast.Field(chain=["e", "$session_id"]),  # TODO: only when including recordings
                ast.Field(chain=["e", "$window_id"]),  # TODO: only when including recordings
            ],
            select_from=ast.JoinExpr(
                table=ast.Field(chain=["events"]),
                alias="e",
                sample=(ast.SampleExpr(sample_value=self._sample_value_expr())),
            ),
            where=ast.And(exprs=[*self._entity_where_expr(), *self._prop_where_expr(), *self._date_where_expr()]),
            group_by=[],
        )
        return query

    def _sample_value_expr(self) -> ast.RatioExpr:
        if self.query.samplingFactor is None:
            return ast.RatioExpr(left=ast.Constant(value=1))

        return ast.RatioExpr(left=ast.Constant(value=self.query.samplingFactor))

    def _actor_id_expr(self) -> ast.Expr:
        if self.series.math == "unique_group" and self.series.math_group_type_index is not None:
            return ast.Field(chain=["e", f"$group_{int(self.series.math_group_type_index)}"])
        return ast.Field(chain=["e", "person_id"])

        # @cached_property
        # def _aggregation_operation(self) -> AggregationOperations:
        #     return AggregationOperations(
        #         self.team,
        #         self.series,
        #         self._trends_display.display_type,
        #         self.query_date_range,
        #         self._trends_display.is_total_value(),
        #     )

        # def _events_filter(
        #     self,
        #     is_actors_query: bool,
        #     breakdown: Breakdown | None,
        #     ignore_breakdowns: bool = False,
        #     breakdown_values_override: Optional[str | int] = None,
        #     actors_query_time_frame: Optional[str] = None,
        # ) -> ast.Expr:

        #         {self._get_not_null_actor_condition()}

        #     # Breakdown
        #     if not ignore_breakdowns and breakdown is not None:
        #         if breakdown.enabled and not breakdown.is_histogram_breakdown:
        #             breakdown_filter = breakdown.events_where_filter()
        #             if breakdown_filter is not None:
        #                 conditions.append(breakdown_filter)

        #     # Ignore empty groups
        #     if series.math == "unique_group" and series.math_group_type_index is not None:
        #         conditions.append(
        #             ast.CompareOperation(
        #                 op=ast.CompareOperationOp.NotEq,
        #                 left=ast.Field(chain=["e", f"$group_{int(series.math_group_type_index)}"]),
        #                 right=ast.Constant(value=""),
        #             )
        #         )

    def _entity_where_expr(self) -> list[ast.Expr]:
        conditions: list[ast.Expr] = []

        if isinstance(self.series, ActionsNode):
            # Actions
            try:
                action = Action.objects.get(pk=int(self.series.id), team=self.team)
                conditions.append(action_to_expr(action))
            except Action.DoesNotExist:
                # If an action doesn't exist, we want to return no events
                conditions.append(parse_expr("1 = 2"))
        elif isinstance(self.series, EventsNode):
            if self.series.event is not None:
                conditions.append(
                    ast.CompareOperation(
                        op=ast.CompareOperationOp.Eq,
                        left=ast.Field(chain=["event"]),
                        right=ast.Constant(value=str(self.series.event)),
                    )
                )

            if self.series.properties is not None and self.series.properties != []:
                conditions.append(property_to_expr(self.series.properties, self.team))
        else:
            raise ValueError(f"Invalid series kind {self.series.kind}")

        return conditions

    def _prop_where_expr(self) -> list[ast.Expr]:
        conditions: list[ast.Expr] = []

        # Filter Test Accounts
        if (
            self.query.filterTestAccounts
            and isinstance(self.team.test_account_filters, list)
            and len(self.team.test_account_filters) > 0
        ):
            for property in self.team.test_account_filters:
                conditions.append(property_to_expr(property, self.team))

        # Properties
        if self.query.properties is not None and self.query.properties != []:
            conditions.append(property_to_expr(self.query.properties, self.team))

        return conditions

    def _date_where_expr(self) -> list[ast.Expr]:
        conditions: list[ast.Expr] = []

        #         if compare == Compare.previous:
        #     query_date_range = self.query_previous_date_range

        #     delta_mappings = self.query_previous_date_range.date_from_delta_mappings()
        #     if delta_mappings is not None and time_frame is not None and isinstance(time_frame, str):
        #         relative_delta = relativedelta(**delta_mappings)
        #         parsed_dt = parser.isoparse(time_frame)
        #         parse_dt_with_relative_delta = parsed_dt - relative_delta
        #         time_frame = parse_dt_with_relative_delta.strftime("%Y-%m-%d")
        # else:
        #     query_date_range = self.query_date_range

        if actors_query_time_frame is not None:
            actors_from, actors_to = self.query_date_range.interval_bounds_from_str(actors_query_time_frame)
            query_from, query_to = self.query_date_range.date_from(), self.query_date_range.date_to()
            if self.query.dateRange and self.query.dateRange.explicitDate:
                query_from, query_to = self.query_date_range.date_from(), self.query_date_range.date_to()
                # exclude events before the query start
                if query_from > actors_from:
                    actors_from = query_from
                # exclude events after the query end
                if query_to < actors_to:
                    actors_to = query_to
            conditions.extend(
                [
                    ast.CompareOperation(
                        left=ast.Field(chain=["timestamp"]),
                        op=ast.CompareOperationOp.GtEq,
                        right=ast.Constant(value=actors_from),
                    ),
                    ast.CompareOperation(
                        left=ast.Field(chain=["timestamp"]),
                        op=ast.CompareOperationOp.Lt,
                        right=ast.Constant(value=actors_to),
                    ),
                ]
            )
        else:
            raise ValueError("Actors query without day")
        #     elif not self._aggregation_operation.requires_query_orchestration():
        #         date_range_placeholders = self.query_date_range.to_placeholders()
        #         conditions.extend(
        #             [
        #                 parse_expr(
        #                     "timestamp >= {date_from_with_adjusted_start_of_interval}", placeholders=date_range_placeholders
        #                 ),
        #                 parse_expr("timestamp <= {date_to}", placeholders=date_range_placeholders),
        #             ]
        #         )
        return conditions