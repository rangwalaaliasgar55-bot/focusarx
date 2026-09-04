import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { BreakFreeMoodEntry, BreakFreeMoodsResponse, BreakFreePledgeEntry, BreakFreePledgesResponse, BreakFreeStreakResponse, HealthStatus, LogMoodBody, PostPledgeBody, StartStreakBody } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetBreakFreeStreakUrl: () => string;
/**
 * @summary Get current user streak
 */
export declare const getBreakFreeStreak: (options?: RequestInit) => Promise<BreakFreeStreakResponse>;
export declare const getGetBreakFreeStreakQueryKey: () => readonly ["/api/break-free/streak"];
export declare const getGetBreakFreeStreakQueryOptions: <TData = Awaited<ReturnType<typeof getBreakFreeStreak>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakFreeStreak>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBreakFreeStreak>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBreakFreeStreakQueryResult = NonNullable<Awaited<ReturnType<typeof getBreakFreeStreak>>>;
export type GetBreakFreeStreakQueryError = ErrorType<void>;
/**
 * @summary Get current user streak
 */
export declare function useGetBreakFreeStreak<TData = Awaited<ReturnType<typeof getBreakFreeStreak>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakFreeStreak>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getStartBreakFreeStreakUrl: () => string;
/**
 * @summary Start or reset streak with a start date
 */
export declare const startBreakFreeStreak: (startStreakBody: StartStreakBody, options?: RequestInit) => Promise<BreakFreeStreakResponse>;
export declare const getStartBreakFreeStreakMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof startBreakFreeStreak>>, TError, {
        data: BodyType<StartStreakBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof startBreakFreeStreak>>, TError, {
    data: BodyType<StartStreakBody>;
}, TContext>;
export type StartBreakFreeStreakMutationResult = NonNullable<Awaited<ReturnType<typeof startBreakFreeStreak>>>;
export type StartBreakFreeStreakMutationBody = BodyType<StartStreakBody>;
export type StartBreakFreeStreakMutationError = ErrorType<void>;
/**
* @summary Start or reset streak with a start date
*/
export declare const useStartBreakFreeStreak: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof startBreakFreeStreak>>, TError, {
        data: BodyType<StartStreakBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof startBreakFreeStreak>>, TError, {
    data: BodyType<StartStreakBody>;
}, TContext>;
export declare const getReportBreakFreeRelapseUrl: () => string;
/**
 * @summary Record a relapse and reset streak
 */
export declare const reportBreakFreeRelapse: (options?: RequestInit) => Promise<BreakFreeStreakResponse>;
export declare const getReportBreakFreeRelapseMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reportBreakFreeRelapse>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof reportBreakFreeRelapse>>, TError, void, TContext>;
export type ReportBreakFreeRelapseMutationResult = NonNullable<Awaited<ReturnType<typeof reportBreakFreeRelapse>>>;
export type ReportBreakFreeRelapseMutationError = ErrorType<void>;
/**
* @summary Record a relapse and reset streak
*/
export declare const useReportBreakFreeRelapse: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reportBreakFreeRelapse>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof reportBreakFreeRelapse>>, TError, void, TContext>;
export declare const getGetBreakFreeMoodsUrl: () => string;
/**
 * @summary Get last 7 days of moods
 */
export declare const getBreakFreeMoods: (options?: RequestInit) => Promise<BreakFreeMoodsResponse>;
export declare const getGetBreakFreeMoodsQueryKey: () => readonly ["/api/break-free/moods"];
export declare const getGetBreakFreeMoodsQueryOptions: <TData = Awaited<ReturnType<typeof getBreakFreeMoods>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakFreeMoods>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBreakFreeMoods>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBreakFreeMoodsQueryResult = NonNullable<Awaited<ReturnType<typeof getBreakFreeMoods>>>;
export type GetBreakFreeMoodsQueryError = ErrorType<void>;
/**
 * @summary Get last 7 days of moods
 */
export declare function useGetBreakFreeMoods<TData = Awaited<ReturnType<typeof getBreakFreeMoods>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakFreeMoods>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getLogBreakFreeMoodUrl: () => string;
/**
 * @summary Log today's mood
 */
export declare const logBreakFreeMood: (logMoodBody: LogMoodBody, options?: RequestInit) => Promise<BreakFreeMoodEntry>;
export declare const getLogBreakFreeMoodMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logBreakFreeMood>>, TError, {
        data: BodyType<LogMoodBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logBreakFreeMood>>, TError, {
    data: BodyType<LogMoodBody>;
}, TContext>;
export type LogBreakFreeMoodMutationResult = NonNullable<Awaited<ReturnType<typeof logBreakFreeMood>>>;
export type LogBreakFreeMoodMutationBody = BodyType<LogMoodBody>;
export type LogBreakFreeMoodMutationError = ErrorType<void>;
/**
* @summary Log today's mood
*/
export declare const useLogBreakFreeMood: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logBreakFreeMood>>, TError, {
        data: BodyType<LogMoodBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logBreakFreeMood>>, TError, {
    data: BodyType<LogMoodBody>;
}, TContext>;
export declare const getGetBreakFreePledgesUrl: () => string;
/**
 * @summary Get latest 20 anonymous pledges
 */
export declare const getBreakFreePledges: (options?: RequestInit) => Promise<BreakFreePledgesResponse>;
export declare const getGetBreakFreePledgesQueryKey: () => readonly ["/api/break-free/pledges"];
export declare const getGetBreakFreePledgesQueryOptions: <TData = Awaited<ReturnType<typeof getBreakFreePledges>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakFreePledges>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBreakFreePledges>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBreakFreePledgesQueryResult = NonNullable<Awaited<ReturnType<typeof getBreakFreePledges>>>;
export type GetBreakFreePledgesQueryError = ErrorType<unknown>;
/**
 * @summary Get latest 20 anonymous pledges
 */
export declare function useGetBreakFreePledges<TData = Awaited<ReturnType<typeof getBreakFreePledges>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakFreePledges>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getPostBreakFreePledgeUrl: () => string;
/**
 * @summary Post an anonymous pledge
 */
export declare const postBreakFreePledge: (postPledgeBody: PostPledgeBody, options?: RequestInit) => Promise<BreakFreePledgeEntry>;
export declare const getPostBreakFreePledgeMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof postBreakFreePledge>>, TError, {
        data: BodyType<PostPledgeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof postBreakFreePledge>>, TError, {
    data: BodyType<PostPledgeBody>;
}, TContext>;
export type PostBreakFreePledgeMutationResult = NonNullable<Awaited<ReturnType<typeof postBreakFreePledge>>>;
export type PostBreakFreePledgeMutationBody = BodyType<PostPledgeBody>;
export type PostBreakFreePledgeMutationError = ErrorType<void>;
/**
* @summary Post an anonymous pledge
*/
export declare const usePostBreakFreePledge: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof postBreakFreePledge>>, TError, {
        data: BodyType<PostPledgeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof postBreakFreePledge>>, TError, {
    data: BodyType<PostPledgeBody>;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map