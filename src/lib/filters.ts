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

import { Filter } from './filter';
import { DataRow } from '../types';

export class Filters {
  public items: Filter[];
  public length: number;

  constructor() {
    this.items = [];
    this.length = 0;
  }

  reset(items: Filter[]): void {
    this.items = items;
    this.length = items.length;
  }

  applyFilters(row: DataRow): boolean {
    return this.items.reduce((valid: boolean, filter: Filter) => {
      return valid && filter.applyFilter(row);
    }, true);
  }
}
