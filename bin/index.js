#! /usr/bin/env node

const fs = require('fs');
const scanner = require('i18next-scanner');
const vfs = require('vinyl-fs');

const languagesArg = process.argv[2]; // languages
const resourcesDirPath = process.argv[3]; // resource files dir path
const packagesDirPath = process.argv[4]; // lerna packages dir path

const defaultTranslationValue = '__TRANSLATION__';
const tmpDir = './tmp';

const checkArgs = () => {
  try {
    if (!languagesArg) {
      throw new Error('Arg [0]: Languages list is not defined!');
    }

    if (!resourcesDirPath) {
      throw new Error('Arg [1]: Resource files directory path is not defined!');
    }

    if (!packagesDirPath) {
      throw new Error('Arg [2]: Lerna packages directory path is not defined!');
    }
  } catch (error) {
    console.error(error.message);

    process.exit();
  }
};

function customTransform(file, enc, done) {
  const {
    parser,
  } = this;
  const content = fs.readFileSync(
    file.path,
    enc,
  );

  parser.parseFuncFromString(
    content,
    {
      list: ['t'],
    },
    (key) => {
      parser.set(
        key,
        defaultTranslationValue,
      );
    },
  );

  done();
}

const sort = (input) => Object.keys(input).sort().reduce(
  (obj, key) => {
    const uObj = obj;

    uObj[key] = input[key];

    return uObj;
  },
  {
  },
);

const getPackageNames = (dirPath) => fs.readdirSync(dirPath)
  .filter((file) => file !== 'common.json')
  .map((file) => file.replace(
    '.json',
    '',
  ));

const extractKeys = (packageName) => {
  const options = {
    keySeparator: false,
    resource: {
      savePath: `${packageName}.json`,
    },
  };

  return new Promise((resolve) => {
    vfs.src([
      `${packagesDirPath}/${packageName}/src/**/*.js`,
      `${packagesDirPath}/${packageName}/src/**/*.pug`,
    ])
      .pipe(scanner(
        options,
        customTransform,
      ))
      .pipe(vfs.dest(tmpDir))
      .on(
        'end',
        () => resolve(),
      );
  });
};

const extract = async (packageNames) => {
  for (let index = 0; index < packageNames.length; index += 1) {
    const packageName = packageNames[index];

    await extractKeys(packageName);
  }
};

const getTranslationKeys = async (packageNames) => {
  const translationKeys = {
  };

  for (let index = 0; index < packageNames.length; index += 1) {
    const packageName = packageNames[index];

    const dataString = fs.readFileSync(`${tmpDir}/${packageName}.json`);
    const data = JSON.parse(dataString);

    translationKeys[packageName] = data;
  }

  return translationKeys;
};

/* eslint-disable-next-line complexity */
const getCommonTranslationKeys = async (packageNames, rawTranslationKeys) => {
  const translationKeys = rawTranslationKeys;
  const rawCommon = {
  };
  const common = {
  };

  for (let index = 0; index < packageNames.length; index += 1) {
    const packageName = packageNames[index];

    for (const [key] of Object.entries(translationKeys[packageName])) {
      if (rawCommon[key]) {
        rawCommon[key] += 1;
      } else {
        rawCommon[key] = 1;
      }
    }
  }

  for (const [key] of Object.entries(rawCommon)) {
    if (rawCommon[key] > 1) {
      common[key] = defaultTranslationValue;
    }
  }

  for (let index = 0; index < packageNames.length; index += 1) {
    const packageName = packageNames[index];

    for (const [key] of Object.entries(common)) {
      if (translationKeys[packageName][key]) {
        delete translationKeys[packageName][key];
      }
    }
  }

  translationKeys.common = common;

  return translationKeys;
};

/* eslint-disable-next-line complexity */
const getTranslations = async (languages, translationKeys) => {
  const translations = {
  };

  for (const [resource] of Object.entries(translationKeys)) {
    translations[resource] = {

    };
    const dataString = fs.readFileSync(`${resourcesDirPath}/${resource}.json`);
    const prevTranslations = JSON.parse(dataString);

    for (let index = 0; index < languages.length; index += 1) {
      const language = languages[index];
      const translation = {
      };

      if (!prevTranslations[language]) {
        prevTranslations[language] = {
          translation: {
          },
        };
      }

      for (const [key] of Object.entries(translationKeys[resource])) {
        if (prevTranslations[language].translation[key]) {
          translation[key] = prevTranslations[language].translation[key];
        } else {
          translation[key] = defaultTranslationValue;
        }
      }

      translations[resource][language] = {
        translation: sort(translation),
      };
    }
  }

  return translations;
};

const saveTranslations = async (translations) => {
  for (const [resource, data] of Object.entries(translations)) {
    const dataString = JSON.stringify(
      data,
      undefined,
      2,
    );

    fs.writeFileSync(
      `${resourcesDirPath}/${resource}.json`,
      dataString,
      'utf8',
    );
  }
};

const main = async () => {
  checkArgs();

  const languages = languagesArg.split(',');
  const packageNames = getPackageNames(resourcesDirPath);

  await extract(packageNames);

  const rawTranslationKeys = await getTranslationKeys(packageNames);

  const translationKeys = await getCommonTranslationKeys(
    packageNames,
    rawTranslationKeys,
  );

  const translations = await getTranslations(
    languages,
    translationKeys,
  );

  await saveTranslations(translations);

  fs.rmSync(
    tmpDir,
    {
      force: true,
      recursive: true,
    },
  );
};

main();
