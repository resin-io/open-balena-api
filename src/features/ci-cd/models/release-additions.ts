import type { AbstractSqlModel } from '@balena/abstract-sql-compiler';

export const addToModel = (abstractSql: AbstractSqlModel) => {
	abstractSql.tables['release'].fields.push({
		fieldName: 'is final',
		dataType: 'Boolean',
		required: true,
		computed: [
			'Equals',
			['ReferencedField', 'release', 'release type'],
			['EmbeddedText', 'final'],
		],
	});

	abstractSql.tables['release'].fields.push({
		fieldName: 'semver',
		dataType: 'Short Text',
		required: true,
		computed: [
			'Concatenate',
			['ReferencedField', 'release', 'semver major'],
			['EmbeddedText', '.'],
			['ReferencedField', 'release', 'semver minor'],
			['EmbeddedText', '.'],
			['ReferencedField', 'release', 'semver patch'],
		],
	});
};
