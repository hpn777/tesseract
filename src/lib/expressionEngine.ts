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

import { Model } from './dataModels/backbone';

export interface ExpressionFunction {
  (a?: any, b?: any, c?: any): any;
}

export interface ExpressionFunctions {
  [key: string]: ExpressionFunction;
}

export const Functions: ExpressionFunctions = {
  '+': (a: any, b: any) => a + b,
  '-': (a: any, b: any) => a - b,
  '/': (a: any, b: any) => a / b,
  '*': (a: any, b: any) => a * b,
  '||': (a: any, b: any) => a || b,
  '&&': (a: any, b: any) => a && b,
  '==': (a: any, b: any) => a == b,
  'eq': (a: any, b: any) => a == b,
  'neq': (a: any, b: any) => a != b,
  '!=': (a: any, b: any) => a != b,
  'lt': (a: any, b: any) => a < b,
  '<': (a: any, b: any) => a < b,
  'gt': (a: any, b: any) => a > b,
  '>': (a: any, b: any) => a > b,
  'lte': (a: any, b: any) => a <= b,
  '<=': (a: any, b: any) => a <= b,
  'gte': (a: any, b: any) => a >= b,
  '>=': (a: any, b: any) => a >= b,
  'regex': (a: any, b: any) => a?.match(b),
  '~': (a: any, b: any) => a && b && a.toLowerCase().indexOf(b.toLowerCase()) !== -1,
  'like': (a: any, b: any) => a && b && a.toLowerCase().indexOf(b.toLowerCase()) !== -1,
  'notlike': (a: any, b: any) => a && b && a.toLowerCase().indexOf(b.toLowerCase()) === -1,
  '!~': (a: any, b: any) => a && b && a.toLowerCase().indexOf(b.toLowerCase()) === -1,
  'in': (a: any, b: any) => b && b.indexOf(a) !== -1,
  'notin': (a: any, b: any) => b && b.indexOf(a) === -1,
  '?:': (a: any, b: any, c: any) => a ? b : c
};

export interface ExpressionNode {
  Value: any;
  Type: string;
  Operand: string | null;
  children: ExpressionNode[];
  expanded: boolean;
  text?: string;
  subExpression?: string;
  scope?: string;
  toString(): string;
}

export interface ExpressionTree extends ExpressionNode {}

export class ExpressionEngine extends Model {
  public expressions: any[];

  constructor(...args: any[]) {
    super(...args);
    this.expressions = [];
  }

  public generateExpressionTree(entryString: string): ExpressionTree {
    const me = this;
    const bracketsRegex = /([\"\"])/;
    const stringTokens: { [key: string]: string } = {};
    const bracketTokens: { [key: string]: ExpressionNode } = {};
    let bracketIndex = 0;

    let processedString = entryString;

    // Handle string literals
    if (processedString.split(bracketsRegex).length > 0) {
      const matches = processedString.split(bracketsRegex);
      for (let i = 0; i < matches.length; i++) {
        if (matches[i] === '"') {
          const start = i;
          let end = -1;
          for (let k = i + 1; k < matches.length; k++) {
            if (matches[k] === '"' && matches[k - 1] !== '\\') {
              end = k;
              i = k;
              break;
            }
          }
          const tempSubString = matches.slice(start + 1, end).join('');
          stringTokens['%%' + start + '%'] = tempSubString;
          processedString = processedString.replace(matches.slice(start, end + 1).join(''), '%%' + start + '%');
        }
      }
    }
    
    entryString = entryString.replace(/\s+/g, '');
    
    const parseExpression = (entryString: string): ExpressionNode => {
      const bracketsRegex = /([\(\)])/;
      const logicalOperatorsRegex = /(\|\||\&\&)/;
      const booleanOperatorsRegex = /(\=\=|\!\=|\>\=|\<\=|\<|\>|~| like |!~| notlike | in | notin )/;
      const conditionalOperatorsRegex = /(\?|\:)/;
      const arithmeticOperatorsRegex = /(\+|\-|\*|\/)/;
      const lambdaExprRegex = /(\=\>)/;
      
      const node: ExpressionNode = {
        Value: null,
        Type: 'object',
        Operand: null,
        children: [],
        expanded: true,
        toString: me.toString.bind(me)
      };

      let processedEntry = entryString;

      // Tokenize brackets
      if (processedEntry.split(bracketsRegex).length > 0) {
        const matches = processedEntry.split(bracketsRegex);
        for (let i = 0; i < matches.length; i++) {
          if (matches[i] === "(") {
            const start = i;
            let end = -1;
            let level = 0;
            for (let k = i + 1; k < matches.length; k++) {
              if (k > i) {
                if (matches[k] === ")" && level === 0) {
                  end = k;
                  i = k;
                  break;
                } else if (matches[k] === ")") {
                  level--;
                } else if (matches[k] === "(") {
                  level++;
                }
              }
            }
            const parentNode = parseExpression(matches.slice(start + 1, end).join(''));
            bracketTokens['%bracket' + bracketIndex + '%'] = parentNode;
            processedEntry = processedEntry.replace(matches.slice(start, end + 1).join(''), '%bracket' + bracketIndex + '%');
            bracketIndex++;
          }
        }
      }

      // Parse lambda expressions
      if (processedEntry.split(lambdaExprRegex).length === 3) {
        const lambdaAttributes = processedEntry.split(lambdaExprRegex);
        node.Operand = "=>";
        node.Type = "lambda";
        node.Value = lambdaAttributes[0].trim();
        const subExpressionNode = parseExpression(lambdaAttributes[2].trim());
        subExpressionNode.scope = lambdaAttributes[0].trim();
        node.children.push(subExpressionNode);
      }
      // Parse function attributes
      else if (processedEntry.split(',').length > 1) {
        const functionAttrs = processedEntry.split(',');
        node.Operand = ",";
        node.Type = 'attributes';
        node.text = "Attributes";
        functionAttrs.forEach((functionAttr) => {
          node.children.push(parseExpression(functionAttr.trim()));
        });
      }
      // Parse conditional statements
      else if (processedEntry.split(conditionalOperatorsRegex).length === 5) {
        const conditionalExprs = processedEntry.split(conditionalOperatorsRegex);
        node.Operand = "?:";
        node.text = "Conditional Expression";
        node.Type = 'condition';

        if (conditionalExprs[1] === "?" && conditionalExprs[3] === ":") {
          for (let i = 0; i <= 4; i += 2) {
            let parentNodeCondition: ExpressionNode;
            if (!bracketTokens[conditionalExprs[i]]) {
              parentNodeCondition = parseExpression(conditionalExprs[i].trim());
            } else {
              parentNodeCondition = bracketTokens[conditionalExprs[i]];
            }
            node.children.push(parentNodeCondition);
          }
          node.subExpression = node.toString();
        }
      }
      // Parse logical operators
      else if (processedEntry.split(logicalOperatorsRegex).length >= 3) {
        const boolExprs = processedEntry.split(logicalOperatorsRegex);
        node.Operand = boolExprs[1].trim();
        node.text = boolExprs[1].trim();
        node.Type = 'operator';

        let parentNode: ExpressionNode;
        if (!bracketTokens[boolExprs[0]]) {
          parentNode = parseExpression(boolExprs[0].trim());
        } else {
          parentNode = bracketTokens[boolExprs[0]];
        }
        node.children.push(parentNode);
        const temp = parseExpression(boolExprs.slice(2, boolExprs.length).join(''));
        node.children.push(temp);
      }
      // Parse comparison operators
      else if (processedEntry.split(booleanOperatorsRegex).length === 3) {
        const equationsSides = processedEntry.split(booleanOperatorsRegex);
        
        node.Operand = equationsSides[1].trim();
        node.Value = "[BoolExpression]";
        node.text = equationsSides[1].trim();
        node.Type = 'operator';

        let leftNode: ExpressionNode;
        let rightNode: ExpressionNode;

        if (!bracketTokens[equationsSides[0]]) {
          leftNode = parseExpression(equationsSides[0].trim());
        } else {
          leftNode = bracketTokens[equationsSides[0]];
        }

        if (!bracketTokens[equationsSides[2]]) {
          rightNode = parseExpression(equationsSides[2].trim());
        } else {
          rightNode = bracketTokens[equationsSides[2]];
        }

        node.children.push(leftNode);
        node.children.push(rightNode);
      }
      // Parse arithmetic operations and other expressions
      else if (processedEntry.split(arithmeticOperatorsRegex).length >= 3) {
        const arithmeticExprs = processedEntry.split(arithmeticOperatorsRegex);
        node.Operand = arithmeticExprs[1].trim();
        node.Value = "[ArithmeticExpression]";
        node.text = arithmeticExprs[1].trim();
        node.Type = 'operator';

        let leftNode: ExpressionNode;
        if (!bracketTokens[arithmeticExprs[0]]) {
          leftNode = parseExpression(arithmeticExprs[0].trim());
        } else {
          leftNode = bracketTokens[arithmeticExprs[0]];
        }

        node.children.push(leftNode);
        const temp = parseExpression(arithmeticExprs.slice(2, arithmeticExprs.length).join(''));
        node.children.push(temp);
      }
      // Handle simple values, properties, and functions
      else {
        // Handle string tokens
        if (stringTokens[processedEntry]) {
          node.Value = stringTokens[processedEntry];
          node.Type = 'string';
        }
        // Handle bracket tokens
        else if (bracketTokens[processedEntry.trim()]) {
          return bracketTokens[processedEntry.trim()];
        }
        // Handle property access
        else if (processedEntry.indexOf('.') !== -1) {
          node.Value = processedEntry;
          node.Type = 'property';
        }
        // Handle function calls
        else if (processedEntry.includes('%')) {
          node.Value = processedEntry;
          node.Type = 'function';
        }
        // Handle numbers
        else if (!isNaN(Number(processedEntry))) {
          node.Value = Number(processedEntry);
          node.Type = 'number';
        }
        // Handle boolean literals
        else if (processedEntry === 'true' || processedEntry === 'false') {
          node.Value = processedEntry === 'true';
          node.Type = 'boolean';
        }
        // Handle other values
        else {
          node.Value = processedEntry;
          node.Type = 'value';
        }
      }

      return node;
    };

    return parseExpression(processedString);
  }

  public executeExpressionTree(node: ExpressionTree, args: any): any {
    if (!node) return null;
    let attributes = [];
    switch (node.Type) {
      case 'function':
      case 'contextFunction':
        // @ts-expect-error - Dynamic property access with potentially undefined scope
        var scope = { value: args[node.scope], scope: this, args: args };
        switch (node.children[0].Type) {
          case 'attributes':
            for (var i = 0; i < node.children.length; i++)
              attributes.push(this.executeExpressionTree(node.children[i], args));
            // @ts-expect-error - Dynamic property access with potentially undefined scope
            return this[node.Operand].apply(scope, attributes);
            break;
          case 'lambda':
            // @ts-expect-error - Dynamic property access with potentially undefined scope
            return this[node.Operand].call(scope, node.children[0]);
            break;
          case 'string':
          case 'number':
          case 'undefined':
            // @ts-expect-error - Dynamic property access with potentially undefined scope
            return this[node.Operand].call(scope, node.children[0].Value);
            break;
          case 'variable':
            // @ts-expect-error - Dynamic property access with potentially undefined scope
            return this[node.Operand].call(scope, args[node.children[0].Value]);
            break;
        }
        break;
      case 'attributes':
        for (var i = 0; i < node.children.length; i++)
          attributes.push(this.executeExpressionTree(node.children[i], args));
        return attributes;
        break;
      case 'operator':
        // @ts-expect-error - Dynamic property access with potentially undefined scope
        return Functions[node.Operand](
          this.executeExpressionTree(node.children[0], args),
          this.executeExpressionTree(node.children[1], args)
        );
        break;
      case 'condition':
        // @ts-expect-error - Dynamic property access with potentially undefined scope
        return Functions[node.Operand](
          this.executeExpressionTree(node.children[0], args),
          this.executeExpressionTree(node.children[1], args),
          this.executeExpressionTree(node.children[2], args)
        );
        break;
      case 'stdout'://TODO need to optimize for performance, probably add dinamically change type of parent node
        if (node.children[0].Type === 'variable') {
          // @ts-expect-error - Dynamic property access with potentially undefined scope
          if (args[node.scope])
            // @ts-expect-error - Dynamic property access with potentially undefined scope
            args = args[node.scope];
          node.children[1].scope = node.children[0].Value;
          if (node.children[1].Type === 'variable')
            // @ts-expect-error - Dynamic property access with potentially undefined scope
            return args[node.children[1].scope][node.children[1].Value];
          else
            return this.executeExpressionTree(node.children[1], args);
        }
        else {
          node.children[0].scope = node.scope;
          node.children[1].scope = node.subExpression;
          // @ts-expect-error - Dynamic property access with potentially undefined subExpression
          args[node.subExpression] = this.executeExpressionTree(node.children[0], args);
          return this.executeExpressionTree(node.children[1], args);
        }
        break;
      case 'string':
      case 'number':
      case 'undefined':
        return node.Value;
        break;
      case 'variable':
        return args[node.Value];
        break;
      case 'value':
        // Handle identifiers parsed as 'value' type (should be treated as variables)
        return args[node.Value?.toString().trim()];
        break;
    }
  }

  private getPropertyValue(propertyPath: string, context: any): any {
    if (!propertyPath || !context) return null;
    
    const parts = propertyPath.split('.');
    let current = context;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    return current;
  }

  public toString(): string {
    return '[ExpressionEngine]';
  }
}
