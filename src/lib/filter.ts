/*
MIT License

Copyright (c) 2019 Rafal Okninski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
*/

import { ExpressionEngine, Functions } from './expressionEngine';
import { DataRow } from '../types';

export class Filter extends ExpressionEngine {
  private filterFunction: (row: DataRow) => boolean = () => true;

  constructor(options: any) {
    super(options);

    const value = this.get('value');
    const comparison = this.get('comparison');
    const field = this.get('field');
    const dataType = this.get('dataType') || this.get('type');

    switch (dataType) {
      case 'boolean':
        this.filterFunction = (row: DataRow) => {
          return row[field] == value;
        };
        break;
      case 'date':
      case 'datetime':
        const dateValue = new Date(value).getTime();
        this.filterFunction = (row: DataRow) => {
          return Functions[comparison](row[field], dateValue);
        };
        break;
      case 'custom':
        this.filterFunction = (row: DataRow) => {
          return this.custom(value, row);
        };
        break;
      default:
        this.filterFunction = (row: DataRow) => {
          return Functions[comparison](row[field], value);
        };
    }
  }

  applyFilter(row?: DataRow): boolean {
    if (!row) {
      return true;
    }
    return this.filterFunction ? this.filterFunction(row) : true;
  }

  custom(expression: string, row: DataRow): boolean {
    let customExpression = (this.expressions as any)[expression];
    if (!customExpression) {
      (this.expressions as any)[expression] = customExpression = this.generateExpressionTree(expression);
    }
    return this.executeExpressionTree(customExpression, row);
  }
}
