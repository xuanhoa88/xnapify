import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';

const traverse = _traverse.default;
const generate = _generate.default;

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file === 'node_modules') continue;
      processDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (!content.includes('import.meta.webpackContext')) continue;
      
      try {
        const ast = parse(content, { sourceType: 'module', plugins: ['jsx'] });
        let changed = false;
        
        traverse(ast, {
          CallExpression(path) {
            if (
              path.node.callee.type === 'MemberExpression' &&
              path.node.callee.property.name === 'webpackContext' &&
              path.node.callee.object.type === 'MetaProperty' &&
              path.node.callee.object.meta.name === 'import' &&
              path.node.callee.object.property.name === 'meta'
            ) {
              const args = path.node.arguments;
              if (args.length === 3) {
                path.replaceWith({
                  type: 'CallExpression',
                  callee: path.node.callee,
                  arguments: [
                    args[0],
                    {
                      type: 'ObjectExpression',
                      properties: [
                        {
                          type: 'ObjectProperty',
                          key: { type: 'Identifier', name: 'recursive' },
                          value: args[1]
                        },
                        {
                          type: 'ObjectProperty',
                          key: { type: 'Identifier', name: 'regExp' },
                          value: args[2]
                        }
                      ]
                    }
                  ]
                });
                changed = true;
              }
            }
          }
        });
        
        if (changed) {
          const newCode = generate(ast, {}, content).code;
          fs.writeFileSync(fullPath, newCode);
          console.log(`Updated ${fullPath} via Babel`);
        }
      } catch (e) {
        console.error(`Failed to parse ${fullPath}: ${e.message}`);
      }
    }
  }
}

processDir('./shared');
