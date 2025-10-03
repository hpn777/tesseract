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
  private compiledFilter: ((row: DataRow) => boolean) | null = null;

  constructor() {
    this.items = [];
    this.length = 0;
  }

  reset(items: Filter[]): void {
    this.items = items;
    this.length = items.length;
    this.compiledFilter = null; // Invalidate cache
  }

  private compileFilters(): void {
    if (this.items.length === 0) {
      this.compiledFilter = () => true;
      return;
    }
    
    const filters = this.items;
    const len = filters.length;
    
    this.compiledFilter = (row: DataRow) => {
      for (let i = 0; i < len; i++) {
        if (!filters[i].applyFilter(row)) {
          return false;
        }
      }
      return true;
    };
  }

  applyFilters(row: DataRow): boolean {
    if (!this.compiledFilter) {
      this.compileFilters();
    }
    return this.compiledFilter!(row);
  }
}
