import * as _ from 'lodash';
import * as Bluebird from 'bluebird';

import { Tx } from '@resin/pinejs/out/database-layer/db';
export { Tx } from '@resin/pinejs/out/database-layer/db';

import { sbvrUtils } from '@resin/pinejs';

import { PinejsClientCoreFactory } from 'pinejs-client-core';

import { captureException } from './errors';

export type PinejsClient = sbvrUtils.PinejsClient;

const { root, api } = sbvrUtils;

if (sbvrUtils.db.readTransaction == null) {
	throw new Error('`readTransaction` is unsupported');
}

// TODO: Potential races here. They are unlikely but not impossible. Will fix
// in subsequent PR.
const $getOrInsertId = (
	api: sbvrUtils.PinejsClient,
	resource: string,
	body: AnyObject,
	tx?: Tx,
): Bluebird<{ id: number }> => {
	const apiTx = api.clone({ passthrough: { req: root, tx } });
	return apiTx
		.get({
			resource,
			options: {
				$select: 'id',
				$filter: body,
			},
		})
		.then((results: AnyObject[]) => {
			if (results.length === 0) {
				return apiTx
					.post({
						resource,
						body,
						options: { returnResource: false },
					})
					.then((idObj: { id: number }) => {
						return { ...idObj, ...body };
					});
			} else {
				return results[0] as { id: number };
			}
		});
};

// Given a filter, if a resource exists which supports said filter,
// update it to the values specified in updateFields, otherwise
// insert it with a combination of the filter and updateFields value
const $updateOrInsert = (
	api: PinejsClient,
	resource: string,
	filter: PinejsClientCoreFactory.FilterObj,
	updateFields: AnyObject,
	tx?: Tx,
): Bluebird<{ id: number }> => {
	const apiTx = api.clone({ passthrough: { req: root, tx } });
	return apiTx
		.get({
			resource,
			options: {
				$filter: filter,
				$select: ['id'],
			},
		})
		.then((results: AnyObject[]) => {
			if (results.length === 0) {
				const body = _.cloneDeep(filter);
				_.merge(body, updateFields);
				return apiTx.post({
					resource,
					body,
					options: { returnResource: false },
				}) as Bluebird<{ id: number }>;
			} else if (results.length > 1) {
				throw new Error(
					`updateOrInsert filter not unique for '${resource}': '${JSON.stringify(
						filter,
					)}'`,
				);
			} else {
				// do a patch with the id
				return apiTx
					.patch({
						resource,
						id: results[0].id,
						body: updateFields,
					})
					.return(results[0] as { id: number });
			}
		});
};

export const getOrInsertId = (
	resource: string,
	body: AnyObject,
	tx?: Tx,
): Bluebird<{ id: number }> => $getOrInsertId(api.Auth, resource, body, tx);
export const getOrInsertModelId = (
	resource: string,
	body: AnyObject,
	tx?: Tx,
): Bluebird<{ id: number }> => $getOrInsertId(api.resin, resource, body, tx);

export const updateOrInsert = (
	resource: string,
	filter: PinejsClientCoreFactory.FilterObj,
	updateFields: AnyObject,
	tx?: Tx,
): Bluebird<{ id: number }> =>
	$updateOrInsert(api.Auth, resource, filter, updateFields, tx);
export const updateOrInsertModel = (
	resource: string,
	filter: PinejsClientCoreFactory.FilterObj,
	updateFields: AnyObject,
	tx?: Tx,
): Bluebird<{ id: number }> =>
	$updateOrInsert(api.resin, resource, filter, updateFields, tx);

type TxFn = (tx: Tx, ...args: any[]) => PromiseLike<any>;
type TxFnArgs<T> = T extends (tx: Tx, ...args: infer U) => any ? U : any[];

// This gives the resolved return type, eg
// - `Promise<R>` -> `R`
// - `Bluebird<R>` -> `R`
// - `R` -> `R`
type ResolvableReturnType<T extends (...args: any[]) => any> = T extends (
	...args: any[]
) => Promise<infer R>
	? R
	: T extends (...args: any[]) => Bluebird<infer R>
	? R
	: ReturnType<T>;

// wrapInTransaction(someOperation) => fn
//
// Wraps a function to run inside a
// DB transaction, passed as the first argument
//
// The transaction will commit or rollback
// after waiting on any promise the operation returns
export const wrapInTransaction = <F extends TxFn>(
	fn: F,
): ((...args: TxFnArgs<F>) => Bluebird<ResolvableReturnType<F>>) =>
	function(...args) {
		return sbvrUtils.db.transaction(tx => fn.apply(this, [tx, ...args]));
	};

// Hook helpers

export const getCurrentRequestAffectedIds: typeof sbvrUtils.getAffectedIds = args => {
	// We store the affected ids in the custom props so we only have to fetch it once per request
	if (args.request.custom.affectedIds == null) {
		args.request.custom.affectedIds = sbvrUtils.getAffectedIds(args);
	}
	return args.request.custom.affectedIds;
};

export const createActor = ({
	request,
	tx,
}: sbvrUtils.HookArgs): Bluebird<void> => {
	return api.Auth.post({
		resource: 'actor',
		passthrough: {
			tx,
			req: root,
		},
		options: { returnResource: false },
	}).then((result: AnyObject) => {
		request.values.actor = result.id;
	});
};

export function addDeleteHookForDependents(
	resource: string,
	dependents: Array<[string, string]>,
) {
	sbvrUtils.addPureHook('DELETE', 'resin', resource, {
		PRERUN: args => {
			const { api, req } = args;

			return getCurrentRequestAffectedIds(args).then(resourceIds => {
				if (resourceIds.length === 0) {
					return;
				}

				return Bluebird.mapSeries(
					dependents,
					([dependent, resourceIdField]) => {
						return api
							.delete({
								resource: dependent,
								options: {
									$filter: {
										[resourceIdField]: { $in: resourceIds },
									},
								},
							})
							.tapCatch(err => {
								captureException(
									err,
									`Error deleting resource '${dependent}' before deleting '${resource}' `,
									{
										req,
									},
								);
							});
					},
				).return();
			});
		},
	});
}
