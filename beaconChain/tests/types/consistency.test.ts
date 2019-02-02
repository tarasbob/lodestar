import fs from "fs";
import { assert } from "chai";
import * as types from "../../types";

const typesDir = __dirname + '/../../types/';


describe("types", () => {
  // interfaces are not available at run time, so we must parse our interface
  // files ourselves in order to retrieve their information

  // Get all ts files in our types directory
  const typeFiles = fs.readdirSync(typesDir).filter(s => s.endsWith('.ts'));
  const interfaces = {};
  typeFiles.map(file => {
    // Read file contents as a string
    let fileStr = fs.readFileSync(typesDir+file, "utf-8")
      // remove line comments
      .replace(/\/\/.*\n/g, "")
      // remove multiline comments
      .replace(/\/\*[\s\S]*?\*\//mg, "");
    let match;
    // extract interface definitions
    let interfaceRe = /export interface (.*) {([\s\S]*?)}/g
    while(match = interfaceRe.exec(fileStr)) {
      const name = match[1];
      const fields = match[2]
        // remove newlines
        .replace(/\n/g,"")
        // remove spaces
        .replace(/ /g,"")
        // split fields by ;
        .split(";")
        // remove blank matches
        .filter(s => s)
        // separate the field name from type
        .map(s => {
          let [name, type] = s.split(":");
          // replace string [] with real []
          // allowing for nested arrays
          let nArr = 0
          while (type.match(/\[\]/)) {
            type = type.replace("[]","");
            nArr++;
          }
          for (let i = 0; i < nArr; i++) {
            type = [type];
          }
          return [name, type];
        // turn fields arr into object
        }).reduce((obj, [name, type]) => {
          obj[name] = type;
          return obj;
        }, {})
      interfaces[name] = {
        name,
        fields,
        file,
      };
    }
  });
  // put var imports into an object
  const vars = {}
  for (let name in types) {
    vars[name] = types[name];
  }
  it("Every interface should have a runtime type", () => {
    Object.keys(interfaces)
      .map(name => {
        assert(
          !!vars[name],
          `var ${name} did not exist, file: ${interfaces[name].file}`);
      })
  });
  it("Every interface should be consistent with runtime type", () => {
    Object.values(interfaces)
      .map((iface: any) => {
        const rtVar = vars[iface.name];
        rtVar.fields.map(([name, type]) => {
          assert(
            !!iface.fields[name],
            `${iface.name} field ${name} does not exist, file: ${interfaces[iface.name].file}`);
          console.log(type)
          if (typeof type === 'object') {
          } else if (typeof type === 'string') {
          }
          assert(
            type === iface.fields[name],
            `${type.name} !== ${iface.fields[name]}`
          );
        })
      })
  });
});
